import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError } from "@/lib/coaching/auth"
import { createClientFromProspect } from "@/lib/coaching/leads"
import { SOURCE_LABEL, type LeadSource } from "@/lib/coaching/lead-rules"
import { normalizePhone } from "@/lib/phone"
import { calendarYmd } from "@/lib/calendar"

type Ctx = { params: Promise<{ id: string }> }

/**
 * Convierte al interesado en cliente. Si ya hay un cliente con su celular, no lo duplica: avisa y, con
 * `linkClientId`, solo lo enlaza.
 */
export async function POST(request: Request, { params }: Ctx) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const lead = await prisma.lead.findUnique({ where: { id }, include: { trial: true } })
  if (!lead) return jsonError("Interesado no encontrado", 404)
  if (lead.clientId) return NextResponse.json({ clientId: lead.clientId })

  let clientId: string | null = lead.trial?.clientId ?? null
  if (!clientId && typeof body.linkClientId === "string") {
    const c = await prisma.client.findUnique({ where: { id: body.linkClientId }, select: { id: true } })
    if (!c) return jsonError("Cliente no encontrado", 404)
    clientId = c.id
  }
  const phone = normalizePhone(lead.phone)
  if (!clientId && phone && body.createNew !== true) {
    const same = (await prisma.client.findMany({ where: { phone: { not: null } }, select: { id: true, firstName: true, lastName: true, phone: true } })).find((c) => normalizePhone(c.phone) === phone)
    if (same) return NextResponse.json({ error: "Ya existe un cliente con ese celular", existing: { id: same.id, name: `${same.firstName} ${same.lastName}`.trim() } }, { status: 409 })
  }
  if (!clientId) {
    const client = await createClientFromProspect({
      firstName: lead.firstName, lastName: lead.lastName, phone: lead.phone, email: lead.email, goal: lead.goal, notes: lead.notes,
      dni: lead.trial?.dni, trainer: lead.trial?.trainer,
      intro: `Interesado del ${calendarYmd(lead.createdAt).split("-").reverse().join("/")} (${SOURCE_LABEL[lead.source as LeadSource] ?? "Otro"}${lead.referredBy ? `, lo recomendó ${lead.referredBy}` : ""}).`,
    })
    clientId = client.id
  }
  await prisma.$transaction([
    prisma.lead.update({ where: { id }, data: { stage: "WON", clientId, closedAt: new Date(), nextContactOn: null, lostReason: null } }),
    ...(lead.trial ? [prisma.trialClass.update({ where: { id: lead.trial.id }, data: { clientId, status: lead.trial.status === "SCHEDULED" ? "ATTENDED" : lead.trial.status } })] : []),
  ])
  return NextResponse.json({ clientId }, { status: 201 })
}
