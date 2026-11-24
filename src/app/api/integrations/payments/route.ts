import { NextResponse } from "next/server"
import { addDays } from "date-fns"
import { prisma } from "@/lib/prisma"
import { calendarDate, calendarYmd } from "@/lib/calendar"
import { todayYmd } from "@/lib/coaching/dates"
import { membershipSnapshot } from "@/lib/finance-sync"
import { botGuard } from "@/lib/integrations/bot"
import { notifyAdmin } from "@/lib/coaching/notify"

export const dynamic = "force-dynamic"

const METHODS = new Set(["CARD", "YAPE"])

/**
 * POST /api/integrations/payments — el alumno pagó su renovación con Culqi desde el link del bot.
 * Body: { clientId, planId, amount, reference, method: "CARD" | "YAPE" }
 * Registra el pago y el ingreso como una renovación hecha en la app. `reference` (id del cargo en Culqi)
 * hace la llamada idempotente: reintentarla no duplica nada.
 */
export async function POST(req: Request) {
  const denied = botGuard(req)
  if (denied) return denied
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const { clientId, planId, reference } = body
  const amount = Math.round(Number(body.amount) * 100) / 100
  if (typeof clientId !== "string" || typeof planId !== "string" || typeof reference !== "string" || !reference.trim() || !(amount > 0)) {
    return NextResponse.json({ error: "clientId, planId, amount y reference son obligatorios" }, { status: 400 })
  }
  const method = METHODS.has(String(body.method)) ? String(body.method) : "CARD"
  const concept = (planName: string) => `Renovación ${planName} · Culqi ${reference}`

  const dup = await prisma.payment.findFirst({ where: { clientId, concept: { endsWith: `Culqi ${reference}` } }, include: { client: true } })
  if (dup) return NextResponse.json({ ok: true, duplicated: true, membershipEnd: dup.client.membershipEnd ? calendarYmd(dup.client.membershipEnd) : null })

  const [client, plan] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.membershipPlan.findUnique({ where: { id: planId } }),
  ])
  if (!client || !plan) return NextResponse.json({ error: "Cliente o plan no encontrado" }, { status: 404 })

  // Igual que en la app (fin = inicio + días del plan): la renovación arranca el día en que vence la actual
  // (si aún no venció) o hoy (si ya venció). Así no se pierde ni se regala ningún día.
  const today = todayYmd()
  const currentEnd = client.membershipEnd ? calendarYmd(client.membershipEnd) : null
  const periodStart = currentEnd && currentEnd >= today ? calendarDate(currentEnd) : calendarDate(today)
  const periodEnd = addDays(periodStart, plan.durationDays)
  const paidAt = calendarDate(today)

  const updated = await prisma.$transaction(async (tx) => {
    const snapshot = await membershipSnapshot(tx, clientId)
    const income = await tx.income.create({
      data: { amount, category: "MEMBERSHIP", description: `${concept(plan.name)} - ${client.firstName} ${client.lastName}`, clientId, date: paidAt },
    })
    await tx.payment.create({
      data: { clientId, amount, method, concept: concept(plan.name), paidAt, periodStart, periodEnd, incomeId: income.id, ...snapshot },
    })
    return tx.client.update({
      where: { id: clientId },
      data: {
        membershipPlanId: plan.id,
        // Si renovó antes de vencer, la membresía sigue corriendo desde su inicio original
        membershipStart: currentEnd && currentEnd >= today && client.membershipStart ? client.membershipStart : periodStart,
        membershipEnd: periodEnd,
        isActive: true,
      },
    })
  })

  await notifyAdmin({
    type: "PAYMENT",
    title: "💳 Renovación pagada por WhatsApp",
    body: `${client.firstName} ${client.lastName} · ${plan.name} · S/ ${amount.toFixed(2)} (${method === "YAPE" ? "Yape" : "tarjeta"})`,
    link: `/clients/${client.id}`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, membershipEnd: updated.membershipEnd ? calendarYmd(updated.membershipEnd) : null })
}
