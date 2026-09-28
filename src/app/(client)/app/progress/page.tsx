import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import { clientAchievements } from "@/lib/coaching/stats"
import { formatYmd, toYmd } from "@/lib/coaching/dates"
import { fmtKg } from "@/lib/coaching/workout"
import { cn } from "@/lib/utils"
import { Bar, Card, PageTitle, SectionTitle } from "@/components/coaching/app/ui"
import LineChartCard from "@/components/coaching/LineChartCard"
import ProgressActions from "@/components/coaching/app/ProgressActions"

export default async function ProgressPage() {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const { clientId } = ctx
  const [records, photos, goals, profile, { achievements, streak, totalWorkouts }] = await Promise.all([
    prisma.physicalRecord.findMany({ where: { clientId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.progressPhoto.findMany({ where: { clientId }, orderBy: [{ date: "desc" }] }),
    prisma.coachingGoal.findMany({ where: { clientId }, orderBy: [{ achievedAt: "asc" }, { createdAt: "desc" }] }),
    prisma.coachingProfile.findUnique({ where: { clientId } }),
    clientAchievements(clientId),
  ])

  const series = (k: "weight" | "waist" | "chest" | "arms" | "hips" | "legs" | "bodyFat") => records.filter((r) => r[k] !== null).map((r) => ({ label: formatYmd(toYmd(r.date)), value: r[k] as number }))
  const metrics = [
    ["Peso", "weight", "kg"], ["Cintura", "waist", "cm"], ["Pecho", "chest", "cm"], ["Brazo", "arms", "cm"], ["Cadera", "hips", "cm"], ["Pierna", "legs", "cm"], ["% grasa", "bodyFat", "%"],
  ] as const
  const weight = series("weight")
  const currentWeight = weight.at(-1)?.value ?? null

  return (
    <div className="space-y-4">
      <PageTitle title="Tu evolución" subtitle={`${totalWorkouts} entrenamientos · racha de ${streak} día${streak === 1 ? "" : "s"}`} />

      <Card>
        <SectionTitle emoji="⚖️">Peso</SectionTitle>
        {weight.length ? (
          <p className="text-2xl font-black mb-2">
            {fmtKg(weight[0].value!)} → {fmtKg(currentWeight!)} kg
            {weight.length > 1 && (
              <span className={cn("text-sm ml-2", currentWeight! - weight[0].value! <= 0 ? "text-emerald-400" : "text-orange-400")}>
                {currentWeight! - weight[0].value! > 0 ? "+" : ""}{fmtKg(currentWeight! - weight[0].value!)}
              </span>
            )}
          </p>
        ) : null}
        <LineChartCard data={weight} unit="kg" dark height={180} />
      </Card>

      <ProgressActions photos={photos.map((p) => ({ id: p.id, date: p.date, pose: p.pose, url: p.url }))} />

      <Card>
        <SectionTitle emoji="📏">Medidas</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {metrics.slice(1).map(([label, k, unit]) => {
            const s = series(k)
            if (!s.length) return null
            const d = s.at(-1)!.value! - s[0].value!
            return (
              <div key={k} className="rounded-xl bg-zinc-800/60 p-3">
                <p className="text-xs text-zinc-400">{label}</p>
                <p className="font-bold">{fmtKg(s[0].value!)} → {fmtKg(s.at(-1)!.value!)} {unit}</p>
                {s.length > 1 && <p className={cn("text-xs", d < 0 ? "text-emerald-400" : d > 0 ? "text-orange-400" : "text-zinc-500")}>{d > 0 ? "📈 +" : d < 0 ? "📉 " : ""}{fmtKg(d)} {unit}</p>}
              </div>
            )
          })}
        </div>
        {!records.some((r) => r.waist || r.chest || r.arms) && <p className="text-xs text-zinc-500">Registra tus medidas cada 2–4 semanas.</p>}
      </Card>

      {goals.length > 0 && (
        <Card>
          <SectionTitle emoji="🎯">Tus objetivos</SectionTitle>
          <ul className="space-y-3">
            {goals.map((g) => {
              const current = g.metric === "WEIGHT" ? currentWeight : g.metric === "WAIST" ? series("waist").at(-1)?.value ?? null : null
              const pct = g.startValue !== null && g.targetValue !== null && current !== null && g.startValue !== g.targetValue ? Math.max(0, Math.min(1, (g.startValue - current) / (g.startValue - g.targetValue))) : null
              return (
                <li key={g.id}>
                  <p className={cn("text-sm font-semibold", g.achievedAt && "text-emerald-400")}>{g.achievedAt ? "✅ " : ""}{g.title}</p>
                  <p className="text-xs text-zinc-500">{g.startValue ?? "?"} → {g.targetValue ?? "?"} {g.unit}{g.dueDate ? ` · hasta ${formatYmd(toYmd(g.dueDate), true)}` : ""}</p>
                  {pct !== null && !g.achievedAt && <><Bar value={pct * 100} max={100} className="mt-1.5" /><p className="text-[11px] text-zinc-500 mt-0.5">{Math.round(pct * 100)}%</p></>}
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {profile?.targetWeight && currentWeight && !goals.some((g) => g.metric === "WEIGHT") && (
        <Card>
          <SectionTitle emoji="🎯">Peso objetivo</SectionTitle>
          <p className="text-sm">{profile.targetWeight} kg · te faltan <b>{fmtKg(Math.abs(currentWeight - profile.targetWeight))} kg</b></p>
        </Card>
      )}

      <Card>
        <SectionTitle emoji="🏅">Logros</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {achievements.map((a) => (
            <div key={a.key} className={cn("rounded-xl p-2 text-center", a.unlocked ? "bg-orange-500/10 border border-orange-500/30" : "bg-zinc-800/50 opacity-40")}>
              <p className="text-2xl">{a.emoji}</p>
              <p className="text-[11px] font-semibold leading-tight mt-1">{a.title}</p>
              <p className="text-[9px] text-zinc-500 leading-tight mt-0.5">{a.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
