import { prisma } from "@/lib/prisma"
import { calendarDate, calendarYmd } from "@/lib/calendar"
import { todayYmd } from "./dates"
import { ensureCoachingProfile } from "./lifecycle"
import { normalizePhone } from "@/lib/phone"
import { whatsappUrl } from "@/lib/utils"
import { LEAD_SOURCES, LEAD_STAGES, leadAlert, leadMessage, stageFromTrial, type LeadSource, type LeadStage } from "./lead-rules"

// Interesados: embudo de ventas (Nuevo → Contactado → Clase de prueba → Alumno o Perdido). Solo el admin los ve.

export type LeadRow = {
  id: string
  firstName: string
  lastName: string | null
  phone: string | null
  email: string | null
  goal: string | null
  daysPerWeek: number | null
  planInterest: string | null
  source: LeadSource
  referredBy: string | null
  stage: LeadStage
  lostReason: string | null
  notes: string | null
  nextContactOn: string | null
  contactedAt: string | null
  createdAt: string
  trial: { id: string; date: string; startTime: string; status: string } | null
  clientId: string | null
  alert: string | null
  waUrl: string | null
}

const text = (v: unknown, max = 120) => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : null)

/** Interesados abiertos y los cerrados en los últimos 90 días. */
export async function getLeads() {
  const today = todayYmd()
  const rows = await prisma.lead.findMany({
    where: { OR: [{ stage: { notIn: ["WON", "LOST"] } }, { closedAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }] },
    include: { trial: true },
    orderBy: { createdAt: "desc" },
  })
  const leads: LeadRow[] = rows.map((l) => {
    const trial = l.trial ? { id: l.trial.id, date: calendarYmd(l.trial.trialDate), startTime: l.trial.startTime, status: l.trial.status } : null
    const nextContactOn = l.nextContactOn ? calendarYmd(l.nextContactOn) : null
    const phone = normalizePhone(l.phone)
    return {
      id: l.id, firstName: l.firstName, lastName: l.lastName, phone: l.phone, email: l.email, goal: l.goal, daysPerWeek: l.daysPerWeek,
      planInterest: l.planInterest, source: l.source as LeadSource, referredBy: l.referredBy, stage: l.stage as LeadStage, lostReason: l.lostReason,
      notes: l.notes, nextContactOn, contactedAt: l.contactedAt ? calendarYmd(l.contactedAt) : null, createdAt: calendarYmd(l.createdAt), trial, clientId: l.clientId,
      alert: leadAlert({ stage: l.stage, hours: (Date.now() - l.createdAt.getTime()) / 3_600_000, nextContactOn, trialStatus: trial?.status ?? null, trialDate: trial?.date ?? null }, today),
      waUrl: phone ? whatsappUrl(phone, leadMessage({ firstName: l.firstName, stage: l.stage, goal: l.goal, trialStatus: trial?.status ?? null })) : null,
    }
  })
  return { today, leads }
}

/** Valida los datos de un interesado. Con `partial`, solo los campos enviados. */
export function parseLeadInput(body: Record<string, unknown>, partial = false) {
  const data: Record<string, unknown> = {}
  const has = (k: string) => !partial || k in body
  if (has("firstName")) {
    const v = text(body.firstName, 60)
    if (!v) return { error: "El nombre es obligatorio" } as const
    data.firstName = v
  }
  for (const [k, max] of [["lastName", 60], ["email", 120], ["goal", 120], ["planInterest", 80], ["referredBy", 80], ["lostReason", 80]] as const) if (has(k)) data[k] = text(body[k], max)
  if (has("notes")) data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null
  if (has("phone")) {
    const raw = text(body.phone, 30)
    const phone = normalizePhone(raw)
    if (raw && !phone) return { error: "Celular no válido: 9 dígitos que empiezan con 9, o + y código de país" } as const
    data.phone = phone
  }
  if (has("daysPerWeek")) {
    const d = Math.round(Number(body.daysPerWeek) || 0)
    data.daysPerWeek = d >= 1 && d <= 7 ? d : null
  }
  if (has("source")) data.source = LEAD_SOURCES.includes(body.source as LeadSource) ? body.source : "OTRO"
  if (has("nextContactOn")) {
    const d = text(body.nextContactOn, 10)
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: "Fecha no válida" } as const
    data.nextContactOn = d ? calendarDate(d) : null
  }
  if (partial && "stage" in body) {
    if (!LEAD_STAGES.includes(body.stage as LeadStage)) return { error: "Etapa no válida" } as const
    data.stage = body.stage
    data.closedAt = body.stage === "WON" || body.stage === "LOST" ? new Date() : null
    if (body.stage !== "LOST") data.lostReason = null
    if (body.stage === "LOST" || body.stage === "WON") data.nextContactOn = null
  }
  // Ya se le escribió: queda contactado y se limpia el pendiente
  if (partial && body.contacted === true) {
    data.contactedAt = new Date()
    if (!("nextContactOn" in body)) data.nextContactOn = null
  }
  return { data } as const
}

type TrialRow = { id: string; firstName: string; lastName: string | null; phone: string | null; email: string | null; goal: string | null; status: string; clientId: string | null; createdByName: string | null }

/**
 * Mantiene al interesado al día con su clase de prueba: lo enlaza (o lo crea, si la clase se agendó desde la
 * agenda) y lo mueve de etapa. Si ya había un interesado abierto con el mismo celular, usa ese.
 */
export async function syncLeadFromTrial(trial: TrialRow, opts: { leadId?: string | null; isNew?: boolean } = {}) {
  // La clase de prueba ya se guardó: si falla el embudo, no se pierde la clase
  try {
    await linkLead(trial, opts)
  } catch (e) {
    console.error("[leads] no se pudo actualizar el interesado", (e as Error).message)
  }
}

async function linkLead(trial: TrialRow, opts: { leadId?: string | null; isNew?: boolean }) {
  const phone = normalizePhone(trial.phone)
  const lead =
    (opts.leadId ? await prisma.lead.findUnique({ where: { id: opts.leadId } }) : null) ??
    (await prisma.lead.findUnique({ where: { trialId: trial.id } })) ??
    // Una clase nueva reemplaza a la anterior; editar una clase vieja no le quita la actual
    (phone ? await prisma.lead.findFirst({ where: { phone, stage: { notIn: ["WON", "LOST"] }, ...(opts.isNew ? {} : { trialId: null }) }, orderBy: { createdAt: "desc" } }) : null)
  // Una clase cancelada que nunca tuvo interesado no crea uno
  if (!lead && trial.status === "CANCELLED") return
  // Editar una clase vieja de alguien que ya sigue su proceso con otra clase no lo duplica
  if (!lead && !opts.isNew && phone && (await prisma.lead.count({ where: { phone } }))) return
  const stage = stageFromTrial(lead?.stage ?? "NEW", trial)
  const closed = { clientId: trial.clientId, ...(stage === "WON" ? { closedAt: lead?.closedAt ?? new Date(), nextContactOn: null } : { closedAt: null, lostReason: null }) }
  if (lead) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { trialId: trial.id, stage, contactedAt: lead.contactedAt ?? new Date(), ...closed, clientId: trial.clientId ?? lead.clientId },
    })
  } else {
    await prisma.lead.create({
      data: { firstName: trial.firstName, lastName: trial.lastName, phone, email: trial.email, goal: trial.goal, source: "OTRO", stage, trialId: trial.id, contactedAt: new Date(), createdByName: trial.createdByName, ...closed },
    })
  }
}

/** Al eliminar la clase de prueba, el interesado vuelve a "Contactado" (si no cerró). */
export async function releaseLeadOfTrial(trialId: string) {
  await prisma.lead.updateMany({ where: { trialId, stage: "TRIAL" }, data: { stage: "CONTACTED" } })
}

/** Crea la ficha de cliente de un interesado o de una clase de prueba. */
export async function createClientFromProspect(p: { firstName: string; lastName: string | null; phone: string | null; email: string | null; dni?: string | null; trainer?: string | null; goal: string | null; notes: string | null; intro: string }) {
  // El DNI es único: si ya pertenece a otro cliente, no se repite
  const dniTaken = p.dni ? await prisma.client.findFirst({ where: { OR: [{ dni: p.dni }, { dni2: p.dni }] }, select: { id: true } }) : null
  const client = await prisma.client.create({
    data: {
      firstName: p.firstName,
      lastName: p.lastName ?? "",
      phone: normalizePhone(p.phone) ?? p.phone,
      email: p.email,
      dni: dniTaken ? null : p.dni ?? null,
      trainer: p.trainer ?? null,
      notes: [p.intro, p.goal ? `Objetivo: ${p.goal}.` : null, p.notes].filter(Boolean).join(" "),
    },
  })
  await ensureCoachingProfile(client.id)
  if (p.goal) await prisma.coachingProfile.update({ where: { clientId: client.id }, data: { goal: p.goal } })
  return client
}
