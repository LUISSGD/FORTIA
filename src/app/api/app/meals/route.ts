import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireClient, jsonError, num, str } from "@/lib/coaching/auth"
import { todayYmd } from "@/lib/coaching/dates"
import { itemMacros, optionMacros } from "@/lib/coaching/nutrition"

const YMD = /^\d{4}-\d{2}-\d{2}$/

/**
 * Registrar comida:
 *  - { mealId, optionId, status: "DONE" | "SKIPPED", date? } → comida del plan (reemplaza el registro previo de esa comida/día)
 *  - { foodId, grams, date?, mealName? } → alimento extra de la biblioteca
 *  - { name, kcal, protein, carbs, fat, date? } → comida libre
 */
export async function POST(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const { clientId } = guard
  const body = await request.json()
  const date = typeof body.date === "string" && YMD.test(body.date) && body.date <= todayYmd() ? body.date : todayYmd()

  if (body.mealId) {
    const meal = await prisma.meal.findFirst({
      where: { id: body.mealId, plan: { clientId } },
      include: { options: { include: { items: { include: { food: true } } } } },
    })
    if (!meal) return jsonError("Comida no encontrada", 404)
    const option = meal.options.find((o) => o.id === body.optionId) ?? meal.options[0]
    const status = body.status === "SKIPPED" ? "SKIPPED" : "DONE"
    const m = status === "DONE" && option ? optionMacros(option) : { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    await prisma.mealLog.deleteMany({ where: { clientId, date, mealId: meal.id } })
    const log = await prisma.mealLog.create({
      data: { clientId, date, mealId: meal.id, optionId: option?.id ?? null, name: meal.name, status, ...m, note: str(body.note) },
    })
    return NextResponse.json(log, { status: 201 })
  }

  if (body.foodId) {
    const food = await prisma.food.findUnique({ where: { id: body.foodId } })
    if (!food) return jsonError("Alimento no encontrado", 404)
    const grams = num(body.grams) ?? 100
    const m = itemMacros({ grams, food })
    const log = await prisma.mealLog.create({
      data: { clientId, date, name: `${food.name} (${Math.round(grams)} g)`, status: "DONE", ...m, note: str(body.mealName) },
    })
    return NextResponse.json(log, { status: 201 })
  }

  const name = str(body.name)
  if (!name) return jsonError("Indica qué comiste")
  const log = await prisma.mealLog.create({
    data: {
      clientId, date, name, status: "DONE",
      kcal: num(body.kcal) ?? 0, protein: num(body.protein) ?? 0, carbs: num(body.carbs) ?? 0, fat: num(body.fat) ?? 0,
      note: str(body.note),
    },
  })
  return NextResponse.json(log, { status: 201 })
}

export async function DELETE(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return jsonError("Falta id")
  await prisma.mealLog.deleteMany({ where: { id, clientId: guard.clientId } })
  return NextResponse.json({ ok: true })
}
