import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import { FOOD_CATEGORIES } from "@/lib/coaching/constants"
import { lastNDays } from "@/lib/coaching/dates"
import { Card, PageTitle } from "@/components/coaching/app/ui"
import ShoppingList from "@/components/coaching/app/ShoppingList"

/**
 * Lista de compras para 7 días: por cada comida usa la opción que el cliente más eligió
 * en las últimas 2 semanas (o la opción A si aún no registra).
 */
export default async function ShoppingPage() {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const plan = await prisma.mealPlan.findFirst({
    where: { clientId: ctx.clientId, isActive: true, isTemplate: false },
    include: { meals: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" }, include: { items: { include: { food: true } } } } } } },
  })
  if (!plan) redirect("/app/nutrition")
  const since = lastNDays(14)[0]
  const logs = await prisma.mealLog.groupBy({ by: ["optionId"], where: { clientId: ctx.clientId, status: "DONE", optionId: { not: null }, date: { gte: since } }, _count: { _all: true } })
  const counts = new Map(logs.map((l) => [l.optionId, l._count._all]))

  const totals = new Map<string, { name: string; category: string; grams: number; unitName: string | null; unitGrams: number | null }>()
  for (const meal of plan.meals) {
    const option = [...meal.options].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.order - b.order)[0]
    option?.items.forEach((it) => {
      const key = it.food?.id ?? `custom:${it.customName}`
      const cur = totals.get(key) ?? { name: it.food?.name ?? it.customName ?? "", category: it.food?.category ?? "OTROS", grams: 0, unitName: it.food?.unitName ?? null, unitGrams: it.food?.unitGrams ?? null }
      cur.grams += it.grams * 7
      totals.set(key, cur)
    })
  }
  const grouped = Object.entries(FOOD_CATEGORIES)
    .map(([cat, label]) => ({ label, items: [...totals.values()].filter((t) => t.category === cat && t.name).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter((g) => g.items.length)

  return (
    <div className="space-y-4">
      <PageTitle title="Lista de compras" subtitle="Cantidades para 7 días según tus opciones favoritas" back="/app/nutrition" />
      {grouped.length === 0 ? (
        <Card><p className="text-sm text-zinc-400">Tu plan aún no tiene alimentos.</p></Card>
      ) : (
        <ShoppingList
          groups={grouped.map((g) => ({
            label: g.label,
            items: g.items.map((i) => ({
              name: i.name,
              qty: i.unitName && i.unitGrams ? `${Math.ceil(i.grams / i.unitGrams)} ${i.unitName}${Math.ceil(i.grams / i.unitGrams) > 1 ? "s" : ""}` : i.grams >= 1000 ? `${(i.grams / 1000).toFixed(1)} kg` : `${Math.round(i.grams)} g`,
            })),
          }))}
        />
      )}
    </div>
  )
}
