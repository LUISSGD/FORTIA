import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseTrialInput, serializeTrial } from "@/lib/coaching/trials"
import { syncLeadFromTrial } from "@/lib/coaching/leads"
import { LEAD_SOURCES, type LeadSource } from "@/lib/coaching/lead-rules"
import { notifyAdmin } from "@/lib/coaching/notify"
import { botGuard } from "@/lib/integrations/bot"
import { normalizePhone } from "@/lib/phone"

export const dynamic = "force-dynamic"

/**
 * POST /api/integrations/trials — el bot agendó una clase de prueba por WhatsApp.
 * Body: { firstName, lastName?, phone, goal?, date: YYYY-MM-DD, startTime: HH:MM, durationMin?, trainer?, source?, notes? }
 * Crea la clase (aparece en la agenda como "Clase de prueba") y el interesado en el embudo.
 */
export async function POST(req: Request) {
  const denied = botGuard(req)
  if (denied) return denied
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const phone = normalizePhone(typeof body.phone === "string" ? body.phone : null)
  if (!phone) return NextResponse.json({ error: "Celular no válido" }, { status: 400 })
  const r = parseTrialInput({ ...body, phone, email: null, dni: null })
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 })

  const trial = await prisma.trialClass.create({
    data: { ...(r.data as { firstName: string; trialDate: Date; startTime: string }), createdByName: "Bot WhatsApp" },
  })
  await syncLeadFromTrial(trial, { isNew: true })
  // El interesado nuevo queda con el origen real (Instagram, WhatsApp…), no "Otro"
  const source = LEAD_SOURCES.includes(body.source as LeadSource) ? (body.source as LeadSource) : "WHATSAPP"
  await prisma.lead.updateMany({ where: { trialId: trial.id, source: "OTRO" }, data: { source } }).catch(() => {})

  const t = serializeTrial(trial)
  await notifyAdmin({
    type: "TRIAL",
    title: "📅 Clase de prueba agendada por WhatsApp",
    body: `${t.firstName}${t.lastName ? " " + t.lastName : ""} · ${t.date} ${t.startTime}${t.trainer ? " con " + t.trainer : ""}`,
    link: "/coaching/agenda",
  }).catch(() => {})
  return NextResponse.json(t, { status: 201 })
}
