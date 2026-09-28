import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError } from "@/lib/coaching/auth"
import { exerciseData } from "./shared"

export async function GET() {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const exercises = await prisma.exercise.findMany({ where: { isActive: true }, orderBy: [{ muscleGroup: "asc" }, { name: "asc" }] })
  return NextResponse.json(exercises)
}

export async function POST(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const data = exerciseData(await request.json())
  if (!data.name) return jsonError("Nombre obligatorio")
  const dup = await prisma.exercise.findUnique({ where: { name: data.name } })
  if (dup?.isActive) return jsonError("Ya existe un ejercicio con ese nombre")
  const exercise = dup
    ? await prisma.exercise.update({ where: { id: dup.id }, data: { ...data, isActive: true } })
    : await prisma.exercise.create({ data: { ...data, isCustom: true } })
  return NextResponse.json(exercise, { status: 201 })
}
