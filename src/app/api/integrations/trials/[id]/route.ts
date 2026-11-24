import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseTrialInput, serializeTrial } from "@/lib/coaching/trials"
import { syncLeadFromTrial } from "@/lib/coaching/leads"
import { botGuard } from "@/lib/integrations/bot"

export const dynamic = "force-dynamic"

/** GET — estado actual de una clase de prueba (el equipo pudo moverla o marcar asistencia en la app). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = botGuard(req)
  if (denied) return denied
  const { id } = await params
  const trial = await prisma.trialClass.findUnique({ where: { id } })
  return trial ? NextResponse.json(serializeTrial(trial)) : NextResponse.json({ error: "No existe" }, { status: 404 })
}

/**
 * PATCH — el interesado reprogramó o canceló por WhatsApp.
 * Body: { date?, startTime?, trainer?, status?: "CANCELLED" } (solo los campos que cambian).
 * Solo toca clases que siguen agendadas: si el equipo ya marcó asistencia, no se cambia.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = botGuard(req)
  if (denied) return denied
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const allowed: Record<string, unknown> = {}
  for (const k of ["date", "startTime", "trainer", "durationMin"]) if (k in body) allowed[k] = body[k]
  if (body.status === "CANCELLED") allowed.status = "CANCELLED"
  const r = parseTrialInput(allowed, true)
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 })

  const current = await prisma.trialClass.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: "No existe" }, { status: 404 })
  if (current.status !== "SCHEDULED") return NextResponse.json({ error: "La clase ya no está agendada", trial: serializeTrial(current) }, { status: 409 })

  const trial = await prisma.trialClass.update({ where: { id }, data: r.data })
  await syncLeadFromTrial(trial)
  return NextResponse.json(serializeTrial(trial))
}
