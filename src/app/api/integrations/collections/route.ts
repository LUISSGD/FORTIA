import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCollections } from "@/lib/finance/collections"
import { botGuard, isYmd, RENEWAL_INCLUDE, renewalInfo } from "@/lib/integrations/bot"

export const dynamic = "force-dynamic"

// Pasos de Cobranza que el bot envía solo. "PROMISE" (el día que prometió pagar) y los saldos los sigue viendo Luis.
const BOT_STEPS = new Set(["PRE", "DUE", "LATE", "REACTIVATE"])

/**
 * GET /api/integrations/collections — a quién escribir HOY por su renovación, con las mismas reglas y registros
 * que la pantalla Cobranza (antes de vencer, el día, vencido cada 7 días, reactivar 7–60 días, "no renueva", promesas).
 */
export async function GET(req: Request) {
  const denied = botGuard(req)
  if (denied) return denied
  const { today, items } = await getCollections()
  const due = items.filter((i) => i.kind === "RENEWAL" && BOT_STEPS.has(i.step) && i.phone)
  const clients = await prisma.client.findMany({
    where: { id: { in: due.map((i) => i.clientId) } },
    select: { id: true, firstName: true, lastName: true, membershipPlanId: true, membershipPlan: { select: { name: true, price: true } }, ...RENEWAL_INCLUDE },
  })
  const byId = new Map(clients.map((c) => [c.id, c]))
  return NextResponse.json({
    today,
    items: due.flatMap((i) => {
      const c = byId.get(i.clientId)
      if (!c) return []
      const r = renewalInfo(c)
      return [{
        clientId: i.clientId, firstName: c.firstName.trim(), lastName: c.lastName.trim(), phone: i.phone,
        step: i.step, cycleKey: i.cycleKey, dueDate: i.dueDate, daysLeft: i.daysLeft, standby: i.standby,
        planId: c.membershipPlanId, planName: r.planName || c.membershipPlan?.name || "Fortia", amount: r.price, personalTraining: r.personalTraining,
      }]
    }),
  })
}

/** POST /api/integrations/collections — el bot ya le escribió: queda registrado en Cobranza como enviado. Body: { clientId, step, cycleKey } */
export async function POST(req: Request) {
  const denied = botGuard(req)
  if (denied) return denied
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const { clientId, step, cycleKey } = body
  if (typeof clientId !== "string" || typeof step !== "string" || !BOT_STEPS.has(step) || !isYmd(cycleKey)) {
    return NextResponse.json({ error: "Datos no válidos" }, { status: 400 })
  }
  if (!(await prisma.client.count({ where: { id: clientId } }))) return NextResponse.json({ error: "No existe" }, { status: 404 })
  const data = { outcome: "SENT", promiseDate: null, createdByName: "Bot WhatsApp", at: new Date() }
  await prisma.followUp.upsert({
    where: { clientId_kind_step_cycleKey: { clientId, kind: "RENEWAL", step, cycleKey } },
    create: { clientId, kind: "RENEWAL", step, cycleKey, ...data },
    update: data,
  })
  return NextResponse.json({ ok: true })
}
