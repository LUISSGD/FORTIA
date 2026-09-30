import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireNutritionist, jsonError, str } from "@/lib/coaching/auth"
import { notifyClient } from "@/lib/coaching/notify"
import { copyMealPlan, mealPlanInclude, planTargets, saveMeals } from "./shared"

export async function GET(request: Request) {
  const guard = await requireNutritionist()
  if ("error" in guard) return guard.error
  const clientId = new URL(request.url).searchParams.get("clientId")
  return NextResponse.json(
    await prisma.mealPlan.findMany({ where: clientId ? { clientId } : { isTemplate: true }, include: mealPlanInclude, orderBy: { updatedAt: "desc" } })
  )
}

export async function POST(request: Request) {
  const guard = await requireNutritionist()
  if ("error" in guard) return guard.error
  const body = await request.json()
  const clientId = str(body.clientId)

  if (body.copyFrom) {
    const copy = await copyMealPlan(body.copyFrom, { clientId, isTemplate: !clientId, name: str(body.name) ?? undefined })
    if (!copy) return jsonError("Plan no encontrado", 404)
    return NextResponse.json(copy, { status: 201 })
  }

  const name = str(body.name)
  if (!name) return jsonError("Nombre obligatorio")
  if (clientId) await prisma.mealPlan.updateMany({ where: { clientId, isActive: true }, data: { isActive: false } })
  const plan = await prisma.mealPlan.create({
    data: { name, description: str(body.description), isTemplate: !clientId, clientId, ...planTargets(body) },
  })
  const meals = Array.isArray(body.meals)
    ? body.meals
    : ["Desayuno", "Almuerzo", "Snack", "Cena"].map((n) => ({ name: n, options: [{ label: "Opción A", items: [] }] }))
  await saveMeals(plan.id, meals)
  if (clientId) await notifyClient(clientId, { type: "NUTRITION", title: "Nuevo plan de alimentación", body: name, link: "/app/nutrition" })
  return NextResponse.json(plan, { status: 201 })
}
