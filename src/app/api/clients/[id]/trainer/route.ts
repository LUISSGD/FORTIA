import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError } from "@/lib/coaching/auth"
import { TRAINERS } from "@/lib/trainers"

type Ctx = { params: Promise<{ id: string }> }

/** Asigna (o quita) el entrenador de las clases personalizadas del cliente. */
export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const { trainer } = await req.json()
  if (trainer !== null && !TRAINERS.some((t) => t.name === trainer)) return jsonError("Entrenador no válido")
  const client = await prisma.client.update({ where: { id }, data: { trainer }, select: { id: true, trainer: true } })
  return NextResponse.json(client)
}
