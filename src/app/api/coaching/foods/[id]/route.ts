import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError } from "@/lib/coaching/auth"
import { foodData } from "../shared"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const data = foodData(await request.json())
  if (!data.name) return jsonError("Nombre obligatorio")
  const dup = await prisma.food.findUnique({ where: { name: data.name } })
  if (dup && dup.id !== id) return jsonError("Ya existe un alimento con ese nombre")
  return NextResponse.json(await prisma.food.update({ where: { id }, data }))
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const used = await prisma.mealOptionItem.count({ where: { foodId: id } })
  if (used) return jsonError(`Este alimento se usa en ${used} plan(es). Quítalo de los planes antes de eliminarlo.`)
  await prisma.food.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
