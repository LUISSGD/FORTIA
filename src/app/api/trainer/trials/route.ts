import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTrainer, jsonError } from "@/lib/coaching/auth"
import { parseTrialInput, serializeTrial } from "@/lib/coaching/trials"

/** Agenda una clase de prueba (admin o entrenador). */
export async function POST(request: Request) {
  const guard = await requireTrainer()
  if ("error" in guard) return guard.error
  const r = parseTrialInput(await request.json())
  if ("error" in r) return jsonError(r.error ?? "Datos inválidos")
  const trial = await prisma.trialClass.create({
    data: { ...(r.data as { firstName: string; trialDate: Date; startTime: string }), createdByName: guard.session.user?.name ?? null },
  })
  return NextResponse.json(serializeTrial(trial), { status: 201 })
}
