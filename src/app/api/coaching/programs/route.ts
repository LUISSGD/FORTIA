import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError, num, str } from "@/lib/coaching/auth"
import { notifyClient } from "@/lib/coaching/notify"
import { copyProgram, programInclude, saveProgramDays } from "./shared"

export async function GET(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const clientId = new URL(request.url).searchParams.get("clientId")
  const programs = await prisma.program.findMany({
    where: clientId ? { clientId } : { isTemplate: true },
    include: programInclude,
    orderBy: { updatedAt: "desc" },
  })
  return NextResponse.json(programs)
}

/** Crea una rutina: plantilla (sin cliente) o asignada directamente a un cliente. Admite duplicar con `copyFrom`. */
export async function POST(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const body = await request.json()
  const clientId = str(body.clientId)

  if (body.copyFrom) {
    const copy = await copyProgram(body.copyFrom, { clientId, isTemplate: !clientId, name: str(body.name) ?? undefined })
    if (!copy) return jsonError("Programa no encontrado", 404)
    return NextResponse.json(copy, { status: 201 })
  }

  const name = str(body.name)
  if (!name) return jsonError("Nombre obligatorio")
  if (clientId) await prisma.program.updateMany({ where: { clientId, isActive: true }, data: { isActive: false } })
  const program = await prisma.program.create({
    data: {
      name,
      goal: str(body.goal),
      level: str(body.level),
      description: str(body.description),
      weeks: Math.round(num(body.weeks) ?? 4),
      isTemplate: !clientId,
      clientId,
      startDate: clientId ? new Date() : null,
    },
  })
  if (Array.isArray(body.days)) await saveProgramDays(program.id, body.days)
  if (clientId) await notifyClient(clientId, { type: "WORKOUT", title: "Nuevo programa de entrenamiento", body: name, link: "/app/training" })
  return NextResponse.json(program, { status: 201 })
}
