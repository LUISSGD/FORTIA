import { prisma } from "@/lib/prisma"
import { challengeProgress } from "@/lib/coaching/stats"
import { CHALLENGE_METRICS } from "@/lib/coaching/constants"
import { formatYmd, todayYmd } from "@/lib/coaching/dates"
import { Panel, ProgressBar } from "@/components/coaching/kit"
import ChallengeForm from "./ChallengeForm"
import ChallengeActions from "./ChallengeActions"

export const dynamic = "force-dynamic"

export default async function CommunityPage() {
  const [challenges, profiles] = await Promise.all([
    prisma.challenge.findMany({ orderBy: [{ isActive: "desc" }, { startDate: "desc" }] }),
    prisma.coachingProfile.findMany({ where: { status: "ACTIVE" }, select: { clientId: true, client: { select: { firstName: true, lastName: true } } } }),
  ])
  const ids = profiles.map((p) => p.clientId)
  const today = todayYmd()
  const withProgress = await Promise.all(
    challenges.map(async (c) => {
      const map = await challengeProgress(c, ids)
      const ranking = profiles
        .map((p) => ({ name: `${p.client.firstName} ${p.client.lastName}`, value: map.get(p.clientId) ?? 0 }))
        .sort((a, b) => b.value - a.value)
      return { ...c, ranking }
    })
  )

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Comunidad y retos</h1>
          <p className="text-sm text-gray-500">Retos mensuales con ranking opcional. Todos los clientes activos participan automáticamente.</p>
        </div>
        <ChallengeForm />
      </div>
      {withProgress.length === 0 && (
        <Panel><p className="text-sm text-gray-500 text-center py-8">🏆 Crea tu primer reto, por ejemplo “30 días de consistencia”.</p></Panel>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        {withProgress.map((c) => {
          const status = !c.isActive ? "Finalizado" : today < c.startDate ? "Próximo" : today > c.endDate ? "Terminado" : "En curso"
          const completed = c.ranking.filter((r) => r.value >= c.target).length
          return (
            <Panel key={c.id} title={`🏆 ${c.title}`} action={<ChallengeActions id={c.id} isActive={c.isActive} showRanking={c.showRanking} />}>
              <p className="text-xs text-gray-500 mb-1">{CHALLENGE_METRICS[c.metric]} · meta {c.target} · {formatYmd(c.startDate)} – {formatYmd(c.endDate, true)} · <b>{status}</b></p>
              {c.description && <p className="text-sm text-gray-600 mb-3">{c.description}</p>}
              <p className="text-xs text-emerald-600 mb-2">{completed} de {c.ranking.length} completaron el reto</p>
              <ol className="space-y-1.5 max-h-80 overflow-y-auto">
                {c.ranking.map((r, i) => (
                  <li key={r.name} className="text-sm">
                    <div className="flex justify-between">
                      <span>{i < 3 && r.value > 0 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}.`} {r.name}</span>
                      <span className="text-gray-500">{r.value}/{c.target}</span>
                    </div>
                    <ProgressBar value={r.value} max={c.target} className="h-1.5" barClassName={r.value >= c.target ? "bg-emerald-500" : undefined} />
                  </li>
                ))}
              </ol>
            </Panel>
          )
        })}
      </div>
    </>
  )
}
