import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoachOrTrainer, jsonError } from "@/lib/coaching/auth"
import { exerciseData } from "../shared"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireCoachOrTrainer()
  if ("error" in guard) return guard.error
  const { id } = await params
  const data = exerciseData(await request.json())
  if (!data.name) return jsonError("Nombre obligatorio")
  const dup = await prisma.exercise.findUnique({ where: { name: data.name } })
  if (dup && dup.id !== id) return jsonError("Ya existe un ejercicio con ese nombre")
  return NextResponse.json(await prisma.exercise.update({ where: { id }, data }))
}

/** Si el ejercicio ya se usó en rutinas o registros, se archiva para no perder el historial. */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireCoachOrTrainer()
  if ("error" in guard) return guard.error
  const { id } = await params
  const used = await prisma.exercise.findUnique({ where: { id }, select: { _count: { select: { programExercises: true, setLogs: true } } } })
  if (!used) return jsonError("No encontrado", 404)
  if (used._count.programExercises || used._count.setLogs) {
    await prisma.exercise.update({ where: { id }, data: { isActive: false } })
  } else {
    await prisma.exercise.delete({ where: { id } })
  }
  return NextResponse.json({ ok: true })
}
