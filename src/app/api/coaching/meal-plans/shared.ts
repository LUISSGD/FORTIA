import { prisma } from "@/lib/prisma"

const TX_OPTS = { timeout: 30_000, maxWait: 10_000 }
import { num, str } from "@/lib/coaching/auth"
import type { Prisma } from "@/generated/prisma/client"

export const mealPlanInclude = {
  meals: {
    orderBy: { order: "asc" },
    include: {
      options: {
        orderBy: { order: "asc" },
        include: { items: { orderBy: { order: "asc" }, include: { food: true } } },
      },
    },
  },
} satisfies Prisma.MealPlanInclude

type ItemInput = { foodId?: string | null; customName?: unknown; grams?: unknown; kcal?: unknown; protein?: unknown; carbs?: unknown; fat?: unknown }
type OptionInput = { id?: string; label?: unknown; notes?: unknown; items?: ItemInput[] }
type MealInput = { id?: string; name?: unknown; time?: unknown; options?: OptionInput[] }

function itemRows(items: ItemInput[] = []) {
  return items
    .filter((it) => it.foodId || str(it.customName))
    .map((it, i) => ({
      foodId: it.foodId || null,
      customName: it.foodId ? null : str(it.customName),
      grams: num(it.grams) ?? 100,
      kcal: it.foodId ? null : num(it.kcal),
      protein: it.foodId ? null : num(it.protein),
      carbs: it.foodId ? null : num(it.carbs),
      fat: it.foodId ? null : num(it.fat),
      order: i,
    }))
}

/** Guarda comidas → opciones → items conservando IDs de comidas y opciones (los registros del cliente siguen vinculados). */
export async function saveMeals(planId: string, meals: MealInput[]) {
  const currentMeals = await prisma.meal.findMany({ where: { planId }, include: { options: { select: { id: true } } } })
  const keepMeals = new Set(meals.map((m) => m.id).filter(Boolean) as string[])

  await prisma.$transaction(async (tx) => {
    await tx.meal.deleteMany({ where: { planId, id: { in: currentMeals.map((m) => m.id).filter((id) => !keepMeals.has(id)) } } })
    for (const [mi, m] of meals.entries()) {
      const mealData = { name: str(m.name) ?? `Comida ${mi + 1}`, time: str(m.time), order: mi }
      const existing = m.id ? currentMeals.find((c) => c.id === m.id) : undefined
      const mealId = existing
        ? (await tx.meal.update({ where: { id: existing.id }, data: mealData })).id
        : (await tx.meal.create({ data: { ...mealData, planId } })).id

      const options = m.options ?? []
      const keepOpts = new Set(options.map((o) => o.id).filter(Boolean) as string[])
      const currentOpts = existing?.options.map((o) => o.id) ?? []
      await tx.mealOption.deleteMany({ where: { mealId, id: { in: currentOpts.filter((id) => !keepOpts.has(id)) } } })

      for (const [oi, o] of options.entries()) {
        const optData = { label: str(o.label) ?? `Opción ${String.fromCharCode(65 + oi)}`, notes: str(o.notes), order: oi }
        let optionId = o.id && currentOpts.includes(o.id) ? o.id : null
        if (optionId) {
          await tx.mealOption.update({ where: { id: optionId }, data: optData })
          await tx.mealOptionItem.deleteMany({ where: { optionId } })
        } else {
          optionId = (await tx.mealOption.create({ data: { ...optData, mealId } })).id
        }
        const rows = itemRows(o.items)
        if (rows.length) await tx.mealOptionItem.createMany({ data: rows.map((r) => ({ ...r, optionId: optionId! })) })
      }
    }
  }, TX_OPTS)
}

export async function copyMealPlan(sourceId: string, target: { clientId: string | null; isTemplate: boolean; name?: string }) {
  const src = await prisma.mealPlan.findUnique({ where: { id: sourceId }, include: mealPlanInclude })
  if (!src) return null
  return prisma.$transaction(async (tx) => {
    if (target.clientId) await tx.mealPlan.updateMany({ where: { clientId: target.clientId, isActive: true }, data: { isActive: false } })
    const plan = await tx.mealPlan.create({
      data: {
        name: target.name ?? src.name,
        description: src.description,
        isTemplate: target.isTemplate,
        clientId: target.clientId,
        calTarget: src.calTarget,
        proteinTarget: src.proteinTarget,
        carbsTarget: src.carbsTarget,
        fatTarget: src.fatTarget,
      },
    })
    for (const m of src.meals) {
      const meal = await tx.meal.create({ data: { planId: plan.id, name: m.name, time: m.time, order: m.order } })
      for (const o of m.options) {
        const opt = await tx.mealOption.create({ data: { mealId: meal.id, label: o.label, notes: o.notes, order: o.order } })
        if (o.items.length) {
          await tx.mealOptionItem.createMany({
            data: o.items.map((it) => ({
              optionId: opt.id, foodId: it.foodId, customName: it.customName, grams: it.grams, kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat, order: it.order,
            })),
          })
        }
      }
    }
    return plan
  }, TX_OPTS)
}

export function planTargets(body: Record<string, unknown>) {
  const int = (v: unknown) => {
    const n = num(v)
    return n === null ? null : Math.round(n)
  }
  return { calTarget: int(body.calTarget), proteinTarget: int(body.proteinTarget), carbsTarget: int(body.carbsTarget), fatTarget: int(body.fatTarget) }
}
