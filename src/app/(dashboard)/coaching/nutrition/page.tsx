import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { optionMacros } from "@/lib/coaching/nutrition"
import { Panel } from "@/components/coaching/kit"
import FoodLibrary from "./FoodLibrary"
import NewMealPlanButton from "./NewMealPlanButton"

export const dynamic = "force-dynamic"

export default async function CoachingNutritionPage({ searchParams }: PageProps<"/coaching/nutrition">) {
  const tab = (await searchParams).tab === "foods" ? "foods" : "plans"
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Nutrición</h1>
          <p className="text-sm text-gray-500">Planes con opciones por comida: el cliente elige A, B o C sin que tengas que rehacer la dieta.</p>
        </div>
        {tab === "plans" && <NewMealPlanButton />}
      </div>
      <div className="flex gap-1 border-b border-gray-200">
        {[["plans", "Planes"], ["foods", "Alimentos"]].map(([k, l]) => (
          <Link key={k} href={`/coaching/nutrition?tab=${k}`} className={cn("px-3 py-2 text-sm border-b-2 -mb-px", tab === k ? "border-orange-500 text-orange-600 font-medium" : "border-transparent text-gray-500")}>{l}</Link>
        ))}
      </div>
      {tab === "plans" ? <Plans /> : <Foods />}
    </>
  )
}

async function Plans() {
  const plans = await prisma.mealPlan.findMany({
    where: { OR: [{ isTemplate: true }, { isActive: true, client: { coachingProfile: { status: { not: "ENDED" } } } }] },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { firstName: true, lastName: true } },
      meals: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" }, take: 1, include: { items: { include: { food: true } } } } } },
    },
  })
  const templates = plans.filter((p) => p.isTemplate)
  const assigned = plans.filter((p) => !p.isTemplate)
  const kcalOf = (p: (typeof plans)[number]) => Math.round(p.meals.reduce((a, m) => a + (m.options[0] ? optionMacros(m.options[0]).kcal : 0), 0))

  return (
    <>
      <Panel title={`Plantillas (${templates.length})`}>
        {templates.length === 0 ? (
          <p className="text-sm text-gray-500">Crea plantillas por objetivo (ej: “Déficit 2000 kcal”, “Volumen 2800 kcal”).</p>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {templates.map((p) => (
              <Link key={p.id} href={`/coaching/nutrition/${p.id}`} className="block rounded-xl border border-gray-200 p-4 hover:border-orange-300 hover:shadow-sm">
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-gray-500">{p.meals.length} comidas · ≈ {kcalOf(p)} kcal (opción A)</p>
                {p.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.description}</p>}
              </Link>
            ))}
          </div>
        )}
      </Panel>
      <Panel title={`Planes activos de clientes (${assigned.length})`}>
        {assigned.length === 0 ? (
          <p className="text-sm text-gray-500">Asigna planes desde el perfil del cliente o desde una plantilla.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {assigned.map((p) => (
              <li key={p.id} className="py-2 flex justify-between">
                <Link href={`/coaching/nutrition/${p.id}`} className="text-sm font-medium hover:text-orange-600">{p.name}</Link>
                <span className="text-xs text-gray-500">{p.client?.firstName} {p.client?.lastName} · ≈ {kcalOf(p)} kcal</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}

async function Foods() {
  const foods = await prisma.food.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }], include: { _count: { select: { items: true } } } })
  return <FoodLibrary foods={foods.map((f) => ({ id: f.id, name: f.name, category: f.category, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, unitName: f.unitName, unitGrams: f.unitGrams, isCustom: f.isCustom, used: f._count.items }))} />
}
