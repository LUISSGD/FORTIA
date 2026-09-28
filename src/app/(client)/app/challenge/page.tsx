import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import { challengeProgress } from "@/lib/coaching/stats"
import { CHALLENGE_METRICS } from "@/lib/coaching/constants"
import { diffDaysYmd, formatYmd, todayYmd } from "@/lib/coaching/dates"
import { cn } from "@/lib/utils"
import { Bar, Card, PageTitle } from "@/components/coaching/app/ui"

export default async function ChallengePage() {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const today = todayYmd()
  const challenges = await prisma.challenge.findMany({ where: { isActive: true, endDate: { gte: today } }, orderBy: { startDate: "asc" } })
  const participants = await prisma.coachingProfile.findMany({ where: { status: "ACTIVE" }, select: { clientId: true, client: { select: { firstName: true, lastName: true } } } })
  const ids = participants.map((p) => p.clientId)
  const data = await Promise.all(challenges.map(async (c) => ({ c, map: await challengeProgress(c, ids) })))

  return (
    <div className="space-y-4">
      <PageTitle title="Retos" subtitle="Compite contigo mismo… y con la comunidad FORTIA" />
      {data.length === 0 && <Card><p className="text-sm text-zinc-400">No hay retos activos ahora. ¡Atento al próximo!</p></Card>}
      {data.map(({ c, map }) => {
        const mine = map.get(ctx.clientId) ?? 0
        const pct = Math.min(100, Math.round((mine / c.target) * 100))
        const ranking = participants.map((p) => ({ id: p.clientId, name: `${p.client.firstName} ${p.client.lastName[0]}.`, value: map.get(p.clientId) ?? 0 })).sort((a, b) => b.value - a.value)
        const position = ranking.findIndex((r) => r.id === ctx.clientId) + 1
        const started = today >= c.startDate
        return (
          <div key={c.id} className="space-y-3">
            <Card className="bg-gradient-to-br from-orange-500/25 to-zinc-900 border-orange-500/30">
              <p className="text-[11px] uppercase tracking-widest text-orange-400 font-bold">🏆 {started ? "Reto en curso" : `Empieza el ${formatYmd(c.startDate)}`}</p>
              <p className="text-2xl font-black">{c.title}</p>
              {c.description && <p className="text-sm text-zinc-300 mt-1">{c.description}</p>}
              <p className="text-xs text-zinc-400 mt-3">{CHALLENGE_METRICS[c.metric]}</p>
              <Bar value={mine} max={c.target} className="h-3 mt-1" />
              <div className="flex justify-between text-sm mt-1.5">
                <span className="font-bold">{mine} / {c.target}</span>
                <span className="text-zinc-400">{pct}% · {Math.max(0, diffDaysYmd(c.endDate, today))} días restantes</span>
              </div>
              {mine >= c.target && <p className="mt-2 text-emerald-400 font-bold">🎉 ¡Reto completado!</p>}
            </Card>
            {c.showRanking && (
              <Card>
                <p className="text-xs font-bold tracking-widest uppercase text-zinc-400 mb-2">Ranking {position > 0 && <span className="text-orange-400">· vas #{position}</span>}</p>
                <ol className="space-y-1">
                  {ranking.slice(0, 10).map((r, i) => (
                    <li key={r.id} className={cn("flex items-center justify-between rounded-lg px-2 py-1.5 text-sm", r.id === ctx.clientId && "bg-orange-500/15")}>
                      <span>{i < 3 && r.value > 0 ? ["🥇", "🥈", "🥉"][i] : <span className="text-zinc-500 w-5 inline-block">{i + 1}</span>} {r.id === ctx.clientId ? "Tú" : r.name}</span>
                      <span className="font-bold">{r.value}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            )}
          </div>
        )
      })}
    </div>
  )
}
