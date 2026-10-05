import Link from "next/link"
import { ChevronRight, MessageSquare, CheckSquare, Search } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { requireTrainerPage } from "@/lib/coaching/auth"
import { getClientsOverview } from "@/lib/coaching/stats"
import { formatYmd, toYmd } from "@/lib/coaching/dates"
import { withCoachErrors } from "@/components/coaching/withCoachErrors"

export const dynamic = "force-dynamic"

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

async function TrainerClientsPage({ searchParams }: PageProps<"/trainer/clients">) {
  await requireTrainerPage()
  const sp = await searchParams
  const q = typeof sp.q === "string" ? sp.q.trim() : ""

  const overview = (await getClientsOverview()).filter((c) => c.status === "ACTIVE" || c.status === "PAUSED")
  const ids = overview.map((c) => c.id)
  const [programs, pendingCheckIns, ptPlans] = await Promise.all([
    prisma.program.findMany({ where: { clientId: { in: ids }, isActive: true, isTemplate: false }, select: { clientId: true, name: true } }),
    prisma.checkIn.groupBy({ by: ["clientId"], where: { clientId: { in: ids }, reviewedAt: null }, _count: { _all: true } }),
    prisma.clientTrainingPlan.findMany({
      where: { clientId: { in: ids }, status: { in: ["ACTIVE", "PAUSED"] } },
      select: { clientId: true, sessionsCompleted: true, numPacks: true, clasesPerPack: true, sessions: { where: { attended: null, scheduledDate: { gte: new Date() } }, orderBy: { scheduledDate: "asc" }, take: 1, select: { scheduledDate: true } } },
    }),
  ])

  const rows = overview
    .filter((c) => !q || norm(c.name).includes(norm(q)))
    .map((c) => {
      const program = programs.find((p) => p.clientId === c.id)?.name ?? null
      const checkIns = pendingCheckIns.find((x) => x.clientId === c.id)?._count._all ?? 0
      const pt = ptPlans.find((p) => p.clientId === c.id)
      // Prioridad: lo que el entrenador debe atender primero
      const attention = (c.unreadMessages > 0 ? 4 : 0) + (checkIns > 0 ? 3 : 0) + (!program ? 2 : 0) + ((c.daysSinceWorkout ?? 0) >= 5 ? 1 : 0)
      return { ...c, program, checkIns, pt, attention }
    })
    .sort((a, b) => b.attention - a.attention || a.name.localeCompare(b.name))

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Clientes</h1>
          <p className="text-sm text-gray-500">{rows.length} clientes de coaching · primero los que necesitan atención</p>
        </div>
        <form className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input name="q" defaultValue={q} placeholder="Buscar cliente…" className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-orange-300" />
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">{q ? "Sin resultados." : "No hay clientes de coaching activos."}</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
          {rows.map((c) => {
            const ptTotal = c.pt ? c.pt.numPacks * c.pt.clasesPerPack : 0
            const nextPt = c.pt?.sessions[0]?.scheduledDate
            return (
              <li key={c.id}>
                <Link href={`/trainer/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-gray-900 truncate">{c.name}</p>
                      {c.status === "PAUSED" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700">En pausa</span>}
                      {c.unreadMessages > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-500 text-white"><MessageSquare className="h-3 w-3" />{c.unreadMessages}</span>
                      )}
                      {c.checkIns > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700"><CheckSquare className="h-3 w-3" />Check-in</span>
                      )}
                    </div>
                    <p className={cn("text-xs truncate", c.program ? "text-gray-600" : "text-amber-600")}>
                      🏋️ {c.program ?? "Sin rutina asignada"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {c.lastWorkout ? `Último entreno ${formatYmd(c.lastWorkout, true)}` : "Sin entrenamientos"}
                      {` · ${c.workoutsLast7}/${c.trainingDays} esta semana`}
                      {c.trainingAdherence !== null && ` (${c.trainingAdherence}%)`}
                      {c.pt && ` · EP ${c.pt.sessionsCompleted}/${ptTotal}`}
                      {nextPt && ` · próxima clase ${formatYmd(toYmd(nextPt), true)}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default withCoachErrors("Clientes", TrainerClientsPage)
