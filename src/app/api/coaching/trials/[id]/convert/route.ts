import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError } from "@/lib/coaching/auth"
import { createClientFromProspect, syncLeadFromTrial } from "@/lib/coaching/leads"

type Ctx = { params: Promise<{ id: string }> }

/** Convierte al interesado de la clase de prueba en cliente de FORTIA (solo admin). */
export async function POST(_request: Request, { params }: Ctx) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const trial = await prisma.trialClass.findUnique({ where: { id } })
  if (!trial) return jsonError("Clase de prueba no encontrada", 404)
  if (trial.clientId) return NextResponse.json({ clientId: trial.clientId })

  const client = await createClientFromProspect({
    ...trial,
    intro: `Vino a clase de prueba el ${trial.trialDate.toISOString().slice(0, 10).split("-").reverse().join("/")}.`,
  })
  const updated = await prisma.trialClass.update({ where: { id }, data: { clientId: client.id, status: trial.status === "SCHEDULED" ? "ATTENDED" : trial.status } })
  await syncLeadFromTrial(updated)
  return NextResponse.json({ clientId: client.id }, { status: 201 })
}
