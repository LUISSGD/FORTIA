import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError, num, str } from "@/lib/coaching/auth"
import { currentPeriod } from "@/lib/coaching/dates"

function dueDateFor(period: string, billingDay: number) {
  const [y, m] = period.split("-").map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const day = Math.min(Math.max(1, billingDay), last)
  return new Date(`${period}-${String(day).padStart(2, "0")}T12:00:00Z`)
}

/**
 * - { generate: true, period? } → crea las mensualidades del periodo para todos los clientes activos con precio.
 * - { clientId, period, amount, currency?, dueDate? } → crea un cobro puntual.
 */
export async function POST(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const body = await request.json()
  const period = str(body.period) ?? currentPeriod()
  if (!/^\d{4}-\d{2}$/.test(period)) return jsonError("Periodo inválido")

  if (body.generate) {
    const profiles = await prisma.coachingProfile.findMany({ where: { status: "ACTIVE", price: { gt: 0 } } })
    const res = await prisma.coachingPayment.createMany({
      data: profiles.map((p) => ({ clientId: p.clientId, period, amount: p.price!, currency: p.currency, dueDate: dueDateFor(period, p.billingDay) })),
      skipDuplicates: true,
    })
    return NextResponse.json({ created: res.count }, { status: 201 })
  }

  const clientId = str(body.clientId)
  const amount = num(body.amount)
  if (!clientId || !amount) return jsonError("Cliente y monto obligatorios")
  const profile = await prisma.coachingProfile.findUnique({ where: { clientId } })
  const exists = await prisma.coachingPayment.findUnique({ where: { clientId_period: { clientId, period } } })
  if (exists) return jsonError("Ya existe un cobro para ese mes")
  const payment = await prisma.coachingPayment.create({
    data: {
      clientId,
      period,
      amount,
      currency: str(body.currency) ?? profile?.currency ?? "PEN",
      dueDate: body.dueDate ? new Date(`${body.dueDate}T12:00:00Z`) : dueDateFor(period, profile?.billingDay ?? 1),
      notes: str(body.notes),
    },
  })
  return NextResponse.json(payment, { status: 201 })
}
