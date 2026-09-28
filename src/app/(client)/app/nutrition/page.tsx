import Link from "next/link"
import { redirect } from "next/navigation"
import { getClientSession } from "@/lib/coaching/auth"
import { getNutritionDay } from "@/lib/coaching/client-data"
import { addDaysYmd, formatYmdLong, todayYmd } from "@/lib/coaching/dates"
import { optionMacros, quantityLabel, roundMacros } from "@/lib/coaching/nutrition"
import { cn } from "@/lib/utils"
import { Bar, Card, PageTitle, Ring, SectionTitle } from "@/components/coaching/app/ui"
import WaterWidget from "@/components/coaching/app/WaterWidget"
import MealsDay from "@/components/coaching/app/MealsDay"

export default async function NutritionPage({ searchParams }: PageProps<"/app/nutrition">) {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const today = todayYmd()
  const sp = await searchParams
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today && sp.date >= addDaysYmd(today, -6) ? sp.date : today
  const { plan, logs, consumed, targets, waterMl, waterTargetMl } = await getNutritionDay(ctx.clientId, date)
  const days = [addDaysYmd(today, -2), addDaysYmd(today, -1), today]

  return (
    <div className="space-y-4">
      <PageTitle title="Nutrición" subtitle={plan?.name ?? "Sin plan asignado"} />

      <div className="flex gap-2">
        {days.map((d) => (
          <Link key={d} href={`/app/nutrition?date=${d}`} className={cn("flex-1 text-center rounded-xl py-2 text-xs font-semibold", d === date ? "bg-orange-500 text-white" : "bg-zinc-900 text-zinc-400")}>
            {d === today ? "Hoy" : d === addDaysYmd(today, -1) ? "Ayer" : formatYmdLong(d).split(" ")[0]}
          </Link>
        ))}
      </div>

      <Card>
        <div className="flex items-center gap-4">
          <Ring value={consumed.kcal} max={targets.kcal} size={96} stroke={9}>
            <p className="text-lg font-black leading-none">{consumed.kcal}</p>
            <p className="text-[10px] text-zinc-500">/ {targets.kcal} kcal</p>
          </Ring>
          <div className="flex-1 space-y-2.5">
            {([["Proteína", "protein", "bg-rose-500"], ["Carbohidratos", "carbs", "bg-amber-400"], ["Grasas", "fat", "bg-violet-500"]] as const).map(([label, k, color]) => (
              <div key={k}>
                <div className="flex justify-between text-xs"><span className="text-zinc-400">{label}</span><span className="font-bold">{consumed[k]} / {targets[k]} g</span></div>
                <Bar value={consumed[k]} max={targets[k]} className="h-1.5 mt-1" color={color} />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {plan?.description && <Card className="text-sm text-zinc-300 whitespace-pre-wrap">📋 {plan.description}</Card>}

      {plan ? (
        <MealsDay
          date={date}
          meals={plan.meals.map((m) => ({
            id: m.id,
            name: m.name,
            time: m.time,
            options: m.options.map((o) => ({
              id: o.id,
              label: o.label,
              notes: o.notes,
              macros: roundMacros(optionMacros(o)),
              items: o.items.map((it) => ({ name: it.food?.name ?? it.customName ?? "", qty: it.food ? quantityLabel(it.grams, it.food) : it.grams ? `${Math.round(it.grams)} g` : "" })),
            })),
          }))}
          logs={logs.map((l) => ({ id: l.id, mealId: l.mealId, optionId: l.optionId, name: l.name, status: l.status, kcal: Math.round(l.kcal), protein: Math.round(l.protein) }))}
        />
      ) : (
        <Card><p className="text-sm text-zinc-400">Tu coach aún no te asignó un plan. Mientras tanto puedes registrar lo que comes abajo.</p></Card>
      )}

      {!plan && (
        <MealsDay date={date} meals={[]} logs={logs.map((l) => ({ id: l.id, mealId: l.mealId, optionId: l.optionId, name: l.name, status: l.status, kcal: Math.round(l.kcal), protein: Math.round(l.protein) }))} />
      )}

      {date === today && (
        <Card>
          <SectionTitle emoji="💧">Agua</SectionTitle>
          <WaterWidget initialMl={waterMl} targetMl={waterTargetMl} />
        </Card>
      )}

      {plan && (
        <Card href="/app/nutrition/shopping" className="flex items-center justify-between">
          <span className="font-semibold">🛒 Lista de compras semanal</span>
          <span className="text-zinc-500">→</span>
        </Card>
      )}
    </div>
  )
}
