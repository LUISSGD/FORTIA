import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import MealPlanBuilder from "./MealPlanBuilder"

export const dynamic = "force-dynamic"

export default async function MealPlanPage({ params }: PageProps<"/coaching/nutrition/[id]">) {
  const { id } = await params
  const [plan, foods, clients] = await Promise.all([
    prisma.mealPlan.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, coachingProfile: true } },
        meals: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } } } },
      },
    }),
    prisma.food.findMany({ orderBy: { name: "asc" } }),
    prisma.coachingProfile.findMany({ where: { status: "ACTIVE" }, select: { client: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { client: { firstName: "asc" } } }),
  ])
  if (!plan) notFound()
  const cp = plan.client?.coachingProfile
  const s = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v))

  return (
    <MealPlanBuilder
      plan={{
        id: plan.id,
        name: plan.name,
        description: plan.description ?? "",
        isTemplate: plan.isTemplate,
        isActive: plan.isActive,
        client: plan.client ? { id: plan.client.id, name: `${plan.client.firstName} ${plan.client.lastName}` } : null,
        clientTargets: cp ? { calTarget: s(cp.calTarget), proteinTarget: s(cp.proteinTarget), carbsTarget: s(cp.carbsTarget), fatTarget: s(cp.fatTarget) } : null,
        targets: { calTarget: s(plan.calTarget), proteinTarget: s(plan.proteinTarget), carbsTarget: s(plan.carbsTarget), fatTarget: s(plan.fatTarget) },
        meals: plan.meals.map((m) => ({
          id: m.id,
          key: m.id,
          name: m.name,
          time: m.time ?? "",
          options: m.options.map((o) => ({
            id: o.id,
            key: o.id,
            label: o.label,
            notes: o.notes ?? "",
            items: o.items.map((it) => ({
              key: it.id,
              foodId: it.foodId,
              customName: it.customName ?? "",
              grams: String(it.grams),
              kcal: s(it.kcal),
              protein: s(it.protein),
              carbs: s(it.carbs),
              fat: s(it.fat),
            })),
          })),
        })),
      }}
      foods={foods.map((f) => ({ id: f.id, name: f.name, category: f.category, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, unitName: f.unitName, unitGrams: f.unitGrams }))}
      clients={clients.map((c) => ({ id: c.client.id, name: `${c.client.firstName} ${c.client.lastName}` }))}
    />
  )
}
