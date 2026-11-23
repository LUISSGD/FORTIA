import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTrainer, jsonError } from "@/lib/coaching/auth"
import { parseTrialInput, serializeTrial } from "@/lib/coaching/trials"
import { syncLeadFromTrial } from "@/lib/coaching/leads"

/** Agenda una clase de prueba (admin o entrenador). */
export async function POST(request: Request) {
  const guard = await requireTrainer()
  if ("error" in guard) return guard.error
  const body = await request.json()
  const r = parseTrialInput(body)
  if ("error" in r) return jsonError(r.error ?? "Datos inválidos")
  const trial = await prisma.trialClass.create({
    data: { ...(r.data as { firstName: string; trialDate: Date; startTime: string }), createdByName: guard.session.user?.name ?? null },
  })
  // Solo el admin ve a los interesados: únicamente él puede enlazar uno en particular
  await syncLeadFromTrial(trial, { isNew: true, leadId: guard.session.user?.role === "ADMIN" && typeof body.leadId === "string" ? body.leadId : null })
  return NextResponse.json(serializeTrial(trial), { status: 201 })
}
