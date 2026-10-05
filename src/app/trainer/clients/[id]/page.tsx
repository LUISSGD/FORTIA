import Link from "next/link"
import { notFound } from "next/navigation"
import { differenceInYears } from "date-fns"
import { ChevronLeft, LayoutDashboard, Dumbbell, CheckSquare, MessageSquare, CalendarCheck } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { requireTrainerPage } from "@/lib/coaching/auth"
import { clientAchievements } from "@/lib/coaching/stats"
import { formatYmd, toYmd } from "@/lib/coaching/dates"
import { LEVELS, PROFILE_STATUS } from "@/lib/coaching/constants"
import { getPersonalTraining } from "@/lib/coaching/personal-training"
import { Panel, Stat } from "@/components/coaching/kit"
import { withCoachErrors } from "@/components/coaching/withCoachErrors"
import TrainingTab from "@/components/coaching/client-tabs/TrainingTab"
import CheckInsTab from "@/components/coaching/client-tabs/CheckInsTab"
import ChatTab from "@/components/coaching/client-tabs/ChatTab"
import TrainerClientSessions from "./TrainerClientSessions"

export const dynamic = "force-dynamic"

const TABS = [
  ["summary", "Resumen", LayoutDashboard],
  ["training", "Entrenamiento", Dumbbell],
  ["checkins", "Check-ins", CheckSquare],
  ["chat", "Chat", MessageSquare],
  ["ep", "Clases EP", CalendarCheck],
] as const
type Tab = (typeof TABS)[number][0]

async function TrainerClientPage({ params, searchParams }: PageProps<"/trainer/clients/[id]">) {
  await requireTrainerPage()
  const { id } = await params
  const sp = await searchParams

  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true, firstName: true, lastName: true, phone: true, birthDate: true,
      coachingProfile: true,
      trainingPlans: {
        where: { status: { in: ["ACTIVE", "PAUSED"] } },
        include: {
          sessions: { orderBy: [{ isRescheduled: "asc" }, { sessionNumber: "asc" }] },
          scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
        },
        orderBy: { currentPackStart: "desc" },
        take: 1,
      },
      _count: { select: { coachMessages: { where: { channel: "COACHING", sender: "CLIENT", readAt: null } }, checkIns: { where: { reviewedAt: null } } } },
    },
  })
  if (!client) notFound()

  const plan = client.trainingPlans[0] ?? null
  const tabs = TABS.filter(([k]) => k !== "ep" || plan)
  const tab: Tab = (tabs.find(([k]) => k === sp.tab)?.[0] ?? "summary") as Tab
  const badge: Partial<Record<Tab, number>> = { chat: client._count.coachMessages, checkins: client._count.checkIns }
  const profile = client.coachingProfile

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/trainer/clients" className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Volver">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 truncate">{client.firstName.trim()} {client.lastName.trim()}</h1>
          <p className="text-xs text-gray-400">
            {profile ? PROFILE_STATUS[profile.status] ?? profile.status : "Sin perfil de coaching"}
            {client.phone && ` · ${client.phone}`}
          </p>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-gray-100 -mx-4 px-4 md:mx-0 md:px-0">
        {tabs.map(([k, label, Icon]) => (
          <Link
            key={k}
            href={`/trainer/clients/${client.id}?tab=${k}`}
            className={cn("shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px", tab === k ? "border-orange-500 text-orange-600 font-medium" : "border-transparent text-gray-500 hover:text-gray-800")}
          >
            <Icon className="h-4 w-4" />
            {label}
            {!!badge[k] && <span className="ml-0.5 rounded-full bg-orange-500 text-white text-[10px] px-1.5">{badge[k]}</span>}
          </Link>
        ))}
      </nav>

      {tab === "summary" && <SummaryTab clientId={client.id} profile={profile} birthDate={client.birthDate} />}
      {tab === "training" && <TrainingTab clientId={client.id} basePath="/trainer" />}
      {tab === "checkins" && <CheckInsTab clientId={client.id} />}
      {tab === "chat" && <ChatTab clientId={client.id} />}
      {tab === "ep" && plan && (
        <div className="max-w-lg space-y-4">
          <div className="rounded-xl border border-gray-100 p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Plan actual</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Clases</span>
              <span className="font-medium">{plan.sessionsCompleted} / {plan.numPacks * plan.clasesPerPack}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${Math.min(100, (plan.sessionsCompleted / (plan.numPacks * plan.clasesPerPack)) * 100)}%` }} />
            </div>
            {plan.scheduleSlots.length > 0 && (
              <p className="text-xs text-gray-400">
                Horario: {plan.scheduleSlots.map((s) => `${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][s.dayOfWeek]} ${s.startTime.slice(0, 5)}`).join(", ")}
              </p>
            )}
          </div>
          <TrainerClientSessions
            clientId={client.id}
            planId={plan.id}
            sessions={plan.sessions.map((s) => ({
              sessionId: s.id,
              sessionNumber: s.sessionNumber,
              scheduledDate: s.scheduledDate ? s.scheduledDate.toISOString().slice(0, 10) : null,
              attended: s.attended,
              isRescheduled: s.isRescheduled,
            }))}
          />
        </div>
      )}
    </div>
  )
}

type Profile = Awaited<ReturnType<typeof prisma.coachingProfile.findUnique>>

/** Resumen para el entrenador: datos de entrenamiento, sin pagos ni membresía. */
async function SummaryTab({ clientId, profile, birthDate }: { clientId: string; profile: Profile; birthDate: Date | null }) {
  const [program, lastWorkout, workouts7, { streak, totalWorkouts }, pt] = await Promise.all([
    prisma.program.findFirst({ where: { clientId, isActive: true, isTemplate: false }, include: { days: { orderBy: { order: "asc" }, select: { name: true } } } }),
    prisma.workoutLog.findFirst({ where: { clientId, completedAt: { not: null } }, orderBy: { startedAt: "desc" }, select: { date: true, dayName: true, rating: true, notes: true } }),
    prisma.workoutLog.count({ where: { clientId, completedAt: { not: null }, startedAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    clientAchievements(clientId),
    getPersonalTraining(clientId),
  ])
  const age = birthDate ? differenceInYears(new Date(), birthDate) : null
  const nextPt = pt?.upcoming[0] ?? null

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Panel title="Información">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-gray-500">Edad</dt><dd>{age ? `${age} años` : "—"}</dd>
          <dt className="text-gray-500">Objetivo</dt><dd>{profile?.goal ?? "—"}</dd>
          <dt className="text-gray-500">Nivel</dt><dd>{LEVELS[profile?.level ?? ""] ?? "—"}</dd>
          <dt className="text-gray-500">Días/semana</dt><dd>{profile?.trainingDays ?? "—"}</dd>
          <dt className="text-gray-500">Inicio</dt><dd>{profile ? formatYmd(toYmd(profile.startDate), true) : "—"}</dd>
        </dl>
        {profile?.injuries && <p className="mt-3 text-xs bg-red-50 text-red-700 rounded-lg p-2">⚠️ {profile.injuries}</p>}
        {profile?.coachNotes && <p className="mt-2 text-xs bg-gray-50 text-gray-700 rounded-lg p-2 whitespace-pre-wrap">📝 {profile.coachNotes}</p>}
      </Panel>
      <div className="lg:col-span-2 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Últimos 7 días" value={workouts7} hint={profile ? `de ${profile.trainingDays} sesiones` : "sesiones"} />
          <Stat label="Racha activa" value={`${streak} d`} tone="orange" />
          <Stat label="Entrenamientos" value={totalWorkouts} hint="totales" />
          <Stat label="Clases EP" value={pt ? `${pt.used}/${pt.total}` : "—"} hint={pt ? `quedan ${pt.remaining}` : "sin paquete"} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Panel title="🏋️ Rutina actual" action={<Link href="?tab=training" className="text-xs text-orange-600">Ver →</Link>}>
            {program ? (
              <>
                <p className="text-sm font-medium">{program.name}</p>
                <p className="text-xs text-gray-500 mt-1">{program.days.map((d) => d.name).join(" · ")}</p>
              </>
            ) : (
              <p className="text-sm text-amber-600">Sin rutina asignada. Asígnale una en Entrenamiento.</p>
            )}
          </Panel>
          <Panel title="📅 Último entrenamiento">
            {lastWorkout ? (
              <>
                <p className="text-sm font-medium">{lastWorkout.dayName} · {formatYmd(lastWorkout.date, true)}{lastWorkout.rating ? ` · ${"⭐".repeat(lastWorkout.rating)}` : ""}</p>
                {lastWorkout.notes && <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-2">📝 {lastWorkout.notes}</p>}
              </>
            ) : (
              <p className="text-sm text-gray-500">Aún no registra entrenamientos en la app.</p>
            )}
            {nextPt && <p className="text-xs text-gray-500 mt-2">Próxima clase EP: {formatYmd(nextPt, true)}</p>}
          </Panel>
        </div>
      </div>
    </div>
  )
}

export default withCoachErrors("Cliente", TrainerClientPage)
