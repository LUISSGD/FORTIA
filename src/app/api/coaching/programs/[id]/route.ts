import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoachOrTrainer, jsonError, num, str } from "@/lib/coaching/auth"
import { programInclude, saveProgramDays } from "../shared"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const guard = await requireCoachOrTrainer()
  if ("error" in guard) return guard.error
  const { id } = await params
  const program = await prisma.program.findUnique({ where: { id }, include: programInclude })
  if (!program) return jsonError("No encontrado", 404)
  return NextResponse.json(program)
}

export async function PUT(request: Request, { params }: Params) {
  const guard = await requireCoachOrTrainer()
  if ("error" in guard) return guard.error
  const { id } = await params
  const body = await request.json()
  const name = str(body.name)
  if (!name) return jsonError("Nombre obligatorio")
  const program = await prisma.program.findUnique({ where: { id } })
  if (!program) return jsonError("No encontrado", 404)

  if (body.isActive && program.clientId && !program.isActive) {
    await prisma.program.updateMany({ where: { clientId: program.clientId, isActive: true }, data: { isActive: false } })
  }
  await prisma.program.update({
    where: { id },
    data: {
      name,
      goal: str(body.goal),
      level: str(body.level),
      description: str(body.description),
      weeks: Math.round(num(body.weeks) ?? program.weeks),
      ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
    },
  })
  if (Array.isArray(body.days)) await saveProgramDays(id, body.days)
  return NextResponse.json(await prisma.program.findUnique({ where: { id }, include: programInclude }))
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireCoachOrTrainer()
  if ("error" in guard) return guard.error
  const { id } = await params
  await prisma.program.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
