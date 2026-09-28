import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError, str } from "@/lib/coaching/auth"
import { mealPlanInclude, planTargets, saveMeals } from "../shared"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const plan = await prisma.mealPlan.findUnique({ where: { id }, include: mealPlanInclude })
  if (!plan) return jsonError("No encontrado", 404)
  return NextResponse.json(plan)
}

export async function PUT(request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const body = await request.json()
  const name = str(body.name)
  if (!name) return jsonError("Nombre obligatorio")
  const plan = await prisma.mealPlan.findUnique({ where: { id } })
  if (!plan) return jsonError("No encontrado", 404)
  if (body.isActive && plan.clientId && !plan.isActive) {
    await prisma.mealPlan.updateMany({ where: { clientId: plan.clientId, isActive: true }, data: { isActive: false } })
  }
  await prisma.mealPlan.update({
    where: { id },
    data: { name, description: str(body.description), ...planTargets(body), ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}) },
  })
  if (Array.isArray(body.meals)) await saveMeals(id, body.meals)
  return NextResponse.json(await prisma.mealPlan.findUnique({ where: { id }, include: mealPlanInclude }))
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  await prisma.mealPlan.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
