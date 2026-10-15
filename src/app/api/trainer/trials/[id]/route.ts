import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTrainer, jsonError } from "@/lib/coaching/auth"
import { parseTrialInput, serializeTrial } from "@/lib/coaching/trials"

type Ctx = { params: Promise<{ id: string }> }

/** Edita la clase de prueba o cambia su estado (asistió, no vino, cancelada). */
export async function PATCH(request: Request, { params }: Ctx) {
  const guard = await requireTrainer()
  if ("error" in guard) return guard.error
  const { id } = await params
  const r = parseTrialInput(await request.json(), true)
  if ("error" in r) return jsonError(r.error ?? "Datos inválidos")
  const exists = await prisma.trialClass.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return jsonError("Clase de prueba no encontrada", 404)
  const trial = await prisma.trialClass.update({ where: { id }, data: r.data })
  return NextResponse.json(serializeTrial(trial))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const guard = await requireTrainer()
  if ("error" in guard) return guard.error
  const { id } = await params
  await prisma.trialClass.deleteMany({ where: { id } })
  return NextResponse.json({ ok: true })
}
