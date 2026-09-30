import Link from "next/link"
import { notFound } from "next/navigation"
import { differenceInYears } from "date-fns"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  CreditCard,
  Dumbbell,
  Salad,
  TrendingUp,
  CheckSquare,
  DollarSign,
  MessageSquare,
  FileText,
  Settings2,
} from "lucide-react"
import { getClientsOverview, clientAchievements } from "@/lib/coaching/stats"
import { formatYmd, lastNDays, periodLabel, todayYmd, toYmd, dateTimeLima } from "@/lib/coaching/dates"
import { LEVELS, PROFILE_STATUS, ADHERENCE_OPTIONS, SLEEP_OPTIONS, ENERGY_OPTIONS } from "@/lib/coaching/constants"
import { optionMacros, roundMacros } from "@/lib/coaching/nutrition"
import { formatSet, fmtKg } from "@/lib/coaching/workout"
import { Panel, Stat, StatusDot } from "@/components/coaching/kit"
import LineChartCard from "@/components/coaching/LineChartCard"
import ChatPanel from "@/components/coaching/ChatPanel"
import PhysicalTrackingSection from "@/components/clients/PhysicalTrackingSection"
import ProfileSettings from "./ProfileSettings"
import GoalsPanel from "./GoalsPanel"
import AssignPlan from "./AssignPlan"
import ExerciseProgression from "./ExerciseProgression"
import CheckInReview from "./CheckInReview"
import PhotoCompare from "@/components/coaching/PhotoCompare"
import PaymentsTable from "@/components/coaching/PaymentsTable"
import { mpEnabled } from "@/lib/coaching/mercadopago"
import DocumentsManager from "@/components/coaching/DocumentsManager"
import RenewalBadge from "@/components/clients/RenewalBadge"
import MembershipTab from "./MembershipTab"
import { getMembership, getPersonalTraining } from "@/lib/coaching/personal-training"

export const dynamic = "force-dynamic"

const TABS = [
  ["summary", "Resumen", LayoutDashboard],
  ["membership", "Plan y membresía", CreditCard],
  ["training", "Entrenamiento", Dumbbell],
  ["nutrition", "Nutrición", Salad],
  ["progress", "Progreso", TrendingUp],
  ["checkins", "Check-ins", CheckSquare],
  ["payments", "Pagos", DollarSign],
  ["chat", "Chat", MessageSquare],
  ["documents", "Documentos", FileText],
  ["settings", "Ajustes", Settings2],
] as const

type Tab = (typeof TABS)[number][0]

export default async function CoachingClientPage({ params, searchParams }: PageProps<"/coaching/clients/[id]">) {
  const { id } = await params
  const sp = await searchParams
  const tab: Tab = (TABS.find(([k]) => k === sp.tab)?.[0] ?? "summary") as Tab

  const client = await prisma.client.findUnique({
    where: { id },
    include: { coachingProfile: true, user: { select: { email: true } } },
  })
  if (!client?.coachingProfile) notFound()
  const profile = client.coachingProfile
  const overview = (await getClientsOverview()).find((c) => c.id === id)
  const age = client.birthDate ? differenceInYears(new Date(), client.birthDate) : null
  const unread = overview?.unreadMessages ?? 0

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Link href="/coaching/clients" className="text-sm text-gray-500 hover:text-gray-900">←</Link>
          <div className="h-12 w-12 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold">
            {client.firstName[0]}{client.lastName[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              {client.firstName} {client.lastName}
              {overview && <StatusDot level={profile.status !== "ACTIVE" ? "gray" : overview.level} />}
              <RenewalBadge membershipEnd={client.membershipEnd} />
            </h1>
            <p className="text-sm text-gray-500">
              {profile.goal ?? "Sin objetivo"} · {LEVELS[profile.level ?? ""] ?? "—"} · {PROFILE_STATUS[profile.status]}
              {!client.user && <span className="ml-2 text-amber-600">· Sin acceso a la app</span>}
            </p>
          </div>
        </div>
        {overview && overview.alerts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {overview.alerts.map((a, i) => (
              <span key={i} className={cn("text-xs rounded-full px-2.5 py-1", a.level === "red" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>{a.text}</span>
            ))}
          </div>
        )}
      </div>

      {/* Mobile: horizontal scrollable tabs */}
      <div className="md:hidden flex gap-1 overflow-x-auto no-scrollbar border-b border-gray-200">
        {TABS.map(([k, label]) => (
          <Link
            key={k}
            href={`/coaching/clients/${id}?tab=${k}`}
            className={cn("shrink-0 px-3 py-2 text-sm border-b-2 -mb-px", tab === k ? "border-orange-500 text-orange-600 font-medium" : "border-transparent text-gray-500 hover:text-gray-800")}
          >
            {label}
            {k === "chat" && unread > 0 && <span className="ml-1 text-[10px] bg-orange-500 text-white rounded-full px-1.5">{unread}</span>}
          </Link>
        ))}
      </div>

      {/* Desktop: icon sidebar + content */}
      <div className="flex gap-6">
        <div className="hidden md:flex flex-col gap-0.5 shrink-0 pt-1 border-r border-gray-100 pr-3">
          {TABS.map(([k, label, Icon]) => (
            <Link
              key={k}
              href={`/coaching/clients/${id}?tab=${k}`}
              title={label}
              className={cn(
                "relative flex items-center justify-center h-10 w-10 rounded-lg transition-colors",
                tab === k ? "bg-gray-900 text-white" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              )}
            >
              <Icon className="h-5 w-5" />
              {k === "chat" && unread > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-orange-500 rounded-full" />
              )}
            </Link>
          ))}
        </div>

        <div className="flex-1 min-w-0 space-y-4 md:space-y-6">
          {tab === "summary" && <SummaryTab clientId={id} profile={profile} age={age} overview={overview} birthDate={client.birthDate} phone={client.phone} />}
          {tab === "membership" && <MembershipTab clientId={id} />}
          {tab === "training" && <TrainingTab clientId={id} />}
          {tab === "nutrition" && <NutritionTab clientId={id} profile={profile} />}
          {tab === "progress" && <ProgressTab clientId={id} />}
          {tab === "checkins" && <CheckInsTab clientId={id} />}
          {tab === "payments" && <PaymentsTab clientId={id} profile={profile} />}
          {tab === "chat" && <ChatTab clientId={id} />}
          {tab === "documents" && <DocumentsTab clientId={id} />}
          {tab === "settings" && (
            <ProfileSettings
              clientId={id}
              accessEmail={client.user?.email ?? null}
              defaultEmail={client.email}
              profile={{
                ...profile,
                startDate: toYmd(profile.startDate),
                phone: client.phone ?? "",
                email: client.email ?? "",
                birthDate: client.birthDate ? toYmd(client.birthDate) : "",
              }}
            />
          )}
        </div>
      </div>
    </>
  )
}

// ── Resumen ─────────────────────────────────────────────────────────

type Profile = NonNullable<Awaited<ReturnType<typeof prisma.coachingProfile.findUnique>>>
type Overview = Awaited<ReturnType<typeof getClientsOverview>>[number] | undefined

async function SummaryTab({ clientId, profile, age, overview, birthDate, phone }: { clientId: string; profile: Profile; age: number | null; overview: Overview; birthDate: Date | null; phone: string | null }) {
  const [program, plan, goals, weights, { achievements, streak, totalWorkouts }, membership, pt] = await Promise.all([
    prisma.program.findFirst({ where: { clientId, isActive: true }, include: { _count: { select: { days: true } } } }),
    prisma.mealPlan.findFirst({ where: { clientId, isActive: true } }),
    prisma.coachingGoal.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
    prisma.physicalRecord.findMany({ where: { clientId, weight: { not: null } }, orderBy: { date: "asc" }, select: { date: true, weight: true } }),
    clientAchievements(clientId),
    getMembership(clientId),
    getPersonalTraining(clientId),
  ])
  const first = weights[0]?.weight ?? profile.startWeight
  const last = weights.at(-1)?.weight ?? null

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="space-y-4">
        <Panel title="Información">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-500">Edad</dt><dd>{age ? `${age} años` : "—"}</dd>
            <dt className="text-gray-500">Objetivo</dt><dd>{profile.goal ?? "—"}</dd>
            <dt className="text-gray-500">Peso actual</dt><dd>{last ? `${last} kg` : "—"}</dd>
            <dt className="text-gray-500">Peso objetivo</dt><dd>{profile.targetWeight ? `${profile.targetWeight} kg` : "—"}</dd>
            <dt className="text-gray-500">Altura</dt><dd>{profile.heightCm ? `${profile.heightCm} cm` : "—"}</dd>
            <dt className="text-gray-500">Nivel</dt><dd>{LEVELS[profile.level ?? ""] ?? "—"}</dd>
            <dt className="text-gray-500">Inicio</dt><dd>{formatYmd(toYmd(profile.startDate), true)}</dd>
            <dt className="text-gray-500">Cumpleaños</dt><dd>{birthDate ? formatYmd(toYmd(birthDate)) : "—"}</dd>
            <dt className="text-gray-500">Teléfono</dt><dd>{phone ?? "—"}</dd>
            <dt className="text-gray-500">Días/semana</dt><dd>{profile.trainingDays}</dd>
          </dl>
          {profile.injuries && <p className="mt-3 text-xs bg-red-50 text-red-700 rounded-lg p-2">⚠️ {profile.injuries}</p>}
          {profile.coachNotes && <p className="mt-2 text-xs bg-gray-50 text-gray-700 rounded-lg p-2 whitespace-pre-wrap">📝 {profile.coachNotes}</p>}
        </Panel>
        <GoalsPanel clientId={clientId} goals={goals.map((g) => ({ ...g, dueDate: g.dueDate ? toYmd(g.dueDate) : null, achievedAt: g.achievedAt?.toISOString() ?? null, createdAt: g.createdAt.toISOString() }))} currentWeight={last} />
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Entreno 7 días" value={overview?.trainingAdherence === null || !overview ? "—" : `${overview.trainingAdherence}%`} hint={`${overview?.workoutsLast7 ?? 0}/${profile.trainingDays} sesiones`} />
          <Stat label="Nutrición 7 días" value={overview?.nutritionCompliance === null || !overview ? "—" : `${overview.nutritionCompliance}%`} />
          <Stat label="Racha activa" value={`${streak} d`} tone="orange" />
          <Stat label="Entrenamientos" value={totalWorkouts} hint="totales" />
        </div>
        <Panel title="Evolución de peso" action={first && last ? <span className={cn("text-sm font-semibold", last <= first ? "text-emerald-600" : "text-orange-600")}>{first} → {last} kg ({last - first > 0 ? "+" : ""}{fmtKg(last - first)})</span> : null}>
          <LineChartCard data={weights.map((w) => ({ label: formatYmd(toYmd(w.date)), value: w.weight }))} unit="kg" />
        </Panel>
        <div className="grid md:grid-cols-2 gap-4">
          <Panel title="🏋️ Programa actual" action={<Link href={`?tab=training`} className="text-xs text-orange-600">Ver →</Link>}>
            {program ? (
              <p className="text-sm"><span className="font-medium">{program.name}</span> · {program._count.days} días</p>
            ) : (
              <p className="text-sm text-amber-600">Sin programa asignado</p>
            )}
          </Panel>
          <Panel title="🥗 Plan nutricional" action={<Link href={`?tab=nutrition`} className="text-xs text-orange-600">Ver →</Link>}>
            {plan ? <p className="text-sm font-medium">{plan.name}</p> : <p className="text-sm text-amber-600">Sin plan asignado</p>}
            <p className="text-xs text-gray-500 mt-1">
              {profile.calTarget ?? plan?.calTarget ?? "—"} kcal · P {profile.proteinTarget ?? plan?.proteinTarget ?? "—"} g · C {profile.carbsTarget ?? plan?.carbsTarget ?? "—"} g · G {profile.fatTarget ?? plan?.fatTarget ?? "—"} g
            </p>
          </Panel>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Panel title="🎟️ Membresía" action={<Link href={`?tab=membership`} className="text-xs text-orange-600">Ver →</Link>}>
            {!membership || membership.state === "none" ? (
              <p className="text-sm text-amber-600">Sin membresía registrada</p>
            ) : (
              <>
                <p className="text-sm font-medium">{membership.planName ?? "Membresía"}</p>
                <p className={cn("text-xs mt-1", membership.state === "expired" || membership.state === "urgent" ? "text-red-600" : membership.state === "warning" ? "text-amber-600" : "text-gray-500")}>
                  {membership.state === "expired" ? `Venció el ${formatYmd(membership.end!, true)}` : `Vence el ${formatYmd(membership.end!, true)} · ${membership.daysLeft} días`}
                </p>
              </>
            )}
          </Panel>
          <Panel title="🏋️ Entrenamiento personal" action={<Link href={`?tab=membership`} className="text-xs text-orange-600">Ver →</Link>}>
            {pt ? (
              <>
                <p className="text-sm font-medium">{pt.used}/{pt.total} clases usadas · quedan {pt.remaining}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {pt.attended[0] ? `Última: ${formatYmd(pt.attended[0].date, true)}${pt.attended[0].byClient ? " 📱" : ""}` : "Sin clases registradas"}
                  {pt.status === "PAUSED" && " · En pausa"}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500">Sin paquete activo</p>
            )}
          </Panel>
        </div>
        <Panel title="🏅 Logros">
          <div className="flex flex-wrap gap-2">
            {achievements.map((a) => (
              <span key={a.key} title={a.description} className={cn("text-xs rounded-full px-2.5 py-1", a.unlocked ? "bg-orange-50 text-orange-700" : "bg-gray-50 text-gray-400")}>
                {a.emoji} {a.title}
              </span>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

// ── Entrenamiento ───────────────────────────────────────────────────

async function TrainingTab({ clientId }: { clientId: string }) {
  const [programs, templates, workouts] = await Promise.all([
    prisma.program.findMany({ where: { clientId }, orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }], include: { days: { orderBy: { order: "asc" }, include: { _count: { select: { exercises: true } } } } } }),
    prisma.program.findMany({ where: { isTemplate: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.workoutLog.findMany({
      where: { clientId, completedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 60,
      include: { sets: { orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }], include: { exercise: { select: { id: true, name: true } } } } },
    }),
  ])
  const active = programs.find((p) => p.isActive)

  // Progresión por ejercicio (orden cronológico)
  const byExercise = new Map<string, { name: string; sessions: { date: string; sets: { weight: number | null; reps: number | null }[] }[] }>()
  for (const w of [...workouts].reverse()) {
    const grouped = new Map<string, { weight: number | null; reps: number | null }[]>()
    w.sets.forEach((s) => {
      if (!byExercise.has(s.exerciseId)) byExercise.set(s.exerciseId, { name: s.exercise.name, sessions: [] })
      if (!grouped.has(s.exerciseId)) grouped.set(s.exerciseId, [])
      grouped.get(s.exerciseId)!.push({ weight: s.weight, reps: s.reps })
    })
    grouped.forEach((sets, exId) => byExercise.get(exId)!.sessions.push({ date: w.date, sets }))
  }
  const progression = [...byExercise.entries()].map(([exerciseId, v]) => ({ exerciseId, ...v })).sort((a, b) => b.sessions.length - a.sessions.length)

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="space-y-4">
        <Panel title="Programa actual">
          {active ? (
            <div className="space-y-2">
              <Link href={`/coaching/programs/${active.id}`} className="font-semibold text-orange-600 hover:underline">{active.name}</Link>
              <ul className="text-sm space-y-1">
                {active.days.map((d) => (
                  <li key={d.id} className="flex justify-between"><span>{d.name}</span><span className="text-gray-400">{d._count.exercises} ejercicios</span></li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-2">Este cliente no tiene programa activo.</p>
          )}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <AssignPlan kind="program" clientId={clientId} templates={templates} />
          </div>
        </Panel>
        {programs.filter((p) => !p.isActive).length > 0 && (
          <Panel title="Programas anteriores">
            <ul className="text-sm space-y-1">
              {programs.filter((p) => !p.isActive).map((p) => (
                <li key={p.id}><Link href={`/coaching/programs/${p.id}`} className="hover:text-orange-600">{p.name}</Link></li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
      <div className="lg:col-span-2 space-y-4">
        <Panel title="📈 Progresión por ejercicio">
          <ExerciseProgression data={progression} />
        </Panel>
        <Panel title={`Historial de entrenamientos (${workouts.length})`}>
          {workouts.length === 0 ? (
            <p className="text-sm text-gray-500">Aún no registra entrenamientos.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {workouts.map((w) => {
                const notes = (w.exerciseNotes ?? {}) as Record<string, string>
                const groups = new Map<string, { name: string; sets: typeof w.sets }>()
                w.sets.forEach((s) => {
                  if (!groups.has(s.exerciseId)) groups.set(s.exerciseId, { name: s.exercise.name, sets: [] })
                  groups.get(s.exerciseId)!.sets.push(s)
                })
                return (
                  <details key={w.id} className="py-2 group">
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                      <span className="text-sm font-medium">{w.dayName} <span className="text-gray-400 font-normal">· {formatYmd(w.date, true)}</span></span>
                      <span className="text-xs text-gray-500">
                        {w.durationMin} min · {w.volumeKg.toLocaleString("es-PE")} kg{w.rating ? ` · ${"⭐".repeat(w.rating)}` : ""}
                        {(w.notes || Object.values(notes).some(Boolean)) && " · 💬"}
                      </span>
                    </summary>
                    <div className="mt-2 space-y-2 pl-2">
                      {[...groups.entries()].map(([exId, g]) => (
                        <div key={exId} className="text-sm">
                          <p className="font-medium">{g.name}</p>
                          <p className="text-gray-600 text-xs">{g.sets.map((s) => formatSet(s)).join(" · ")}</p>
                          {notes[exId] && <p className="text-xs text-orange-700 bg-orange-50 rounded px-2 py-1 mt-1">💬 {notes[exId]}</p>}
                        </div>
                      ))}
                      {w.notes && <p className="text-xs bg-gray-50 rounded p-2">📝 {w.notes}</p>}
                    </div>
                  </details>
                )
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

// ── Nutrición ───────────────────────────────────────────────────────

async function NutritionTab({ clientId, profile }: { clientId: string; profile: Profile }) {
  const days = lastNDays(14)
  const [plans, templates, logs, water, nutrition] = await Promise.all([
    prisma.mealPlan.findMany({
      where: { clientId },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      include: { meals: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" }, include: { items: { include: { food: true } } } } } } },
    }),
    prisma.mealPlan.findMany({ where: { isTemplate: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.mealLog.findMany({ where: { clientId, date: { gte: days[0] } }, orderBy: { createdAt: "asc" } }),
    prisma.waterLog.groupBy({ by: ["date"], where: { clientId, date: { gte: days[0] } }, _sum: { ml: true } }),
    prisma.nutritionClient.findFirst({
      where: { clientId },
      include: { consultations: { orderBy: { date: "desc" }, take: 5 }, _count: { select: { consultations: true } } },
    }),
  ])
  const active = plans.find((p) => p.isActive)
  const targetKcal = profile.calTarget ?? active?.calTarget ?? null
  const targetP = profile.proteinTarget ?? active?.proteinTarget ?? null
  const mealsPerDay = active?.meals.length ?? 0

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="space-y-4">
        <Panel title="Plan actual">
          {active ? (
            <div className="space-y-2">
              <Link href={`/coaching/nutrition/${active.id}`} className="font-semibold text-orange-600 hover:underline">{active.name}</Link>
              <ul className="text-sm space-y-1">
                {active.meals.map((m) => (
                  <li key={m.id} className="flex justify-between">
                    <span>{m.name}</span>
                    <span className="text-gray-400 text-xs">{m.options.map((o) => `${Math.round(optionMacros(o).kcal)}`).join(" / ")} kcal</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Sin plan activo.</p>
          )}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <AssignPlan kind="mealPlan" clientId={clientId} templates={templates} />
          </div>
        </Panel>
        <Panel title="Objetivos diarios">
          <p className="text-sm">{targetKcal ?? "—"} kcal · P {targetP ?? "—"} g · C {profile.carbsTarget ?? active?.carbsTarget ?? "—"} g · G {profile.fatTarget ?? active?.fatTarget ?? "—"} g</p>
          <p className="text-sm mt-1">💧 {(profile.waterTargetMl / 1000).toFixed(2)} L</p>
          <p className="text-xs text-gray-400 mt-2">Edita los objetivos en la pestaña Ajustes. Se actualizan solos con cada consulta de nutrición.</p>
        </Panel>
        <Panel
          title={`🩺 Consultas de nutrición${nutrition ? ` (${nutrition._count.consultations})` : ""}`}
          action={nutrition ? <Link href={`/nutrition/${nutrition.id}`} className="text-xs text-orange-600">Abrir ficha →</Link> : null}
        >
          {!nutrition ? (
            <p className="text-sm text-gray-500">No tiene ficha en el módulo Nutrición.</p>
          ) : nutrition.consultations.length === 0 ? (
            <p className="text-sm text-gray-500">Sin consultas registradas.</p>
          ) : (
            <ul className="text-sm divide-y divide-gray-100">
              {nutrition.consultations.map((c) => (
                <li key={c.id} className="py-1.5 flex justify-between gap-2">
                  <span>#{c.consultationNumber} · {formatYmd(c.date.toISOString().slice(0, 10), true)}</span>
                  <span className="text-xs text-gray-500">{[c.weight && `${c.weight} kg`, c.calTarget && `${Math.round(c.calTarget)} kcal`].filter(Boolean).join(" · ") || "—"}</span>
                </li>
              ))}
            </ul>
          )}
          {nutrition && (
            <Link href={`/nutrition/${nutrition.id}/consulta`} className="mt-3 inline-block text-xs font-medium text-orange-600">+ Nueva consulta</Link>
          )}
        </Panel>
      </div>
      <Panel title="Registro de los últimos 14 días" className="lg:col-span-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 text-left">
              <tr>
                <th className="py-2 pr-2 font-medium">Día</th>
                <th className="py-2 px-2 font-medium">Comidas</th>
                <th className="py-2 px-2 font-medium">Kcal</th>
                <th className="py-2 px-2 font-medium">Proteína</th>
                <th className="py-2 px-2 font-medium">Carbs</th>
                <th className="py-2 px-2 font-medium">Grasas</th>
                <th className="py-2 pl-2 font-medium">Agua</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...days].reverse().map((d) => {
                const dayLogs = logs.filter((l) => l.date === d)
                const done = dayLogs.filter((l) => l.status === "DONE")
                const planDone = done.filter((l) => l.mealId).length
                const m = roundMacros(done.reduce((a, l) => ({ kcal: a.kcal + l.kcal, protein: a.protein + l.protein, carbs: a.carbs + l.carbs, fat: a.fat + l.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }))
                const ml = water.find((w) => w.date === d)?._sum.ml ?? 0
                return (
                  <tr key={d}>
                    <td className="py-2 pr-2 whitespace-nowrap">{formatYmd(d)}{d === todayYmd() && <span className="text-[10px] text-orange-600 ml-1">hoy</span>}</td>
                    <td className="py-2 px-2">
                      {mealsPerDay ? `${planDone}/${mealsPerDay}` : done.length}
                      {dayLogs.some((l) => l.status === "SKIPPED") && <span className="text-xs text-red-500 ml-1">({dayLogs.filter((l) => l.status === "SKIPPED").length} omitida)</span>}
                    </td>
                    <td className={cn("py-2 px-2", targetKcal && m.kcal > targetKcal * 1.1 ? "text-red-600" : "")}>{m.kcal || "—"}{targetKcal && m.kcal ? <span className="text-gray-400 text-xs"> / {targetKcal}</span> : null}</td>
                    <td className="py-2 px-2">{m.protein || "—"}</td>
                    <td className="py-2 px-2">{m.carbs || "—"}</td>
                    <td className="py-2 px-2">{m.fat || "—"}</td>
                    <td className="py-2 pl-2">{ml ? `${(ml / 1000).toFixed(1)} L` : "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {logs.some((l) => !l.mealId) && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-600 mb-1">Extras registrados</p>
            <ul className="text-xs text-gray-600 space-y-0.5">
              {logs.filter((l) => !l.mealId).slice(-15).reverse().map((l) => (
                <li key={l.id}>{formatYmd(l.date)} · {l.name} · {Math.round(l.kcal)} kcal</li>
              ))}
            </ul>
          </div>
        )}
      </Panel>
    </div>
  )
}

// ── Progreso ────────────────────────────────────────────────────────

async function ProgressTab({ clientId }: { clientId: string }) {
  const [records, photos] = await Promise.all([
    prisma.physicalRecord.findMany({ where: { clientId }, orderBy: { date: "desc" } }),
    prisma.progressPhoto.findMany({ where: { clientId }, orderBy: [{ date: "desc" }, { pose: "asc" }] }),
  ])
  const asc = [...records].reverse()
  const metric = (k: "weight" | "waist" | "chest" | "arms" | "bodyFat" | "hips" | "legs") => {
    const pts = asc.filter((r) => r[k] !== null)
    return pts.length ? { first: pts[0][k]!, last: pts.at(-1)![k]!, series: pts.map((r) => ({ label: formatYmd(toYmd(r.date)), value: r[k] })) } : null
  }
  const metrics = [
    ["Peso", metric("weight"), "kg"],
    ["Cintura", metric("waist"), "cm"],
    ["Pecho", metric("chest"), "cm"],
    ["Brazo", metric("arms"), "cm"],
    ["Cadera", metric("hips"), "cm"],
    ["% grasa", metric("bodyFat"), "%"],
  ] as const

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {metrics.map(([label, m, unit]) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-500">{label}</p>
            {m ? (
              <>
                <p className="text-lg font-bold">{fmtKg(m.first)} → {fmtKg(m.last)} <span className="text-xs font-normal text-gray-400">{unit}</span></p>
                <p className={cn("text-xs", m.last - m.first < 0 ? "text-emerald-600" : m.last - m.first > 0 ? "text-orange-600" : "text-gray-400")}>
                  {m.last - m.first > 0 ? "📈 +" : m.last - m.first < 0 ? "📉 " : ""}{fmtKg(m.last - m.first)} {unit}
                </p>
              </>
            ) : (
              <p className="text-lg text-gray-300">—</p>
            )}
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Peso"><LineChartCard data={metric("weight")?.series ?? []} unit="kg" /></Panel>
        <Panel title="Cintura"><LineChartCard data={metric("waist")?.series ?? []} unit="cm" color="#0ea5e9" /></Panel>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="📸 Fotos de progreso">
          <PhotoCompare photos={photos.map((p) => ({ id: p.id, date: p.date, pose: p.pose, url: p.url }))} />
        </Panel>
        <Panel>
          <PhysicalTrackingSection clientId={clientId} initialRecords={records.map((r) => ({ ...r, date: r.date.toISOString(), createdAt: r.createdAt.toISOString() }))} />
        </Panel>
      </div>
    </div>
  )
}

// ── Check-ins ───────────────────────────────────────────────────────

async function CheckInsTab({ clientId }: { clientId: string }) {
  const checkIns = await prisma.checkIn.findMany({ where: { clientId }, orderBy: { weekStart: "desc" }, include: { photos: true } })
  if (!checkIns.length) return <Panel><p className="text-sm text-gray-500 text-center py-6">El cliente aún no envió check-ins. Se le recuerda automáticamente los domingos.</p></Panel>
  const energySeries = [...checkIns].reverse().map((c) => ({ label: formatYmd(c.weekStart), value: c.energy }))
  return (
    <div className="space-y-4">
      <Panel title="Energía semanal (1–5)"><LineChartCard data={energySeries} height={160} color="#8b5cf6" /></Panel>
      {checkIns.map((c) => (
        <Panel key={c.id} title={`Semana del ${formatYmd(c.weekStart, true)}`} action={c.reviewedAt ? <span className="text-xs text-emerald-600">✅ Revisado</span> : <span className="text-xs text-amber-600">Pendiente de revisión</span>}>
          <div className="grid md:grid-cols-2 gap-4">
            <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
              <dt className="text-gray-500">Energía</dt><dd>{ENERGY_OPTIONS.find((o) => o.value === c.energy)?.emoji} {ENERGY_OPTIONS.find((o) => o.value === c.energy)?.label}</dd>
              <dt className="text-gray-500">Alimentación</dt><dd>{ADHERENCE_OPTIONS.find((o) => o.value === c.nutritionAdherence)?.label}</dd>
              <dt className="text-gray-500">Sueño</dt><dd>{SLEEP_OPTIONS.find((o) => o.value === c.sleep)?.label}</dd>
              {c.stress && (<><dt className="text-gray-500">Estrés</dt><dd>{c.stress}/5</dd></>)}
              {c.weight && (<><dt className="text-gray-500">Peso</dt><dd>{c.weight} kg</dd></>)}
              {c.discomfort && (<><dt className="text-gray-500">Molestias</dt><dd className="text-red-600">{c.discomfort}</dd></>)}
              {c.feelings && (<><dt className="text-gray-500 col-span-2">¿Cómo se sintió?</dt><dd className="col-span-2 bg-gray-50 rounded p-2">{c.feelings}</dd></>)}
            </dl>
            <div className="space-y-2">
              {c.photos.length > 0 && (
                <div className="flex gap-2">
                  {c.photos.map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.pose} className="h-24 w-20 object-cover rounded-lg" /></a>
                  ))}
                </div>
              )}
              <CheckInReview id={c.id} reply={c.coachReply} reviewed={!!c.reviewedAt} />
            </div>
          </div>
        </Panel>
      ))}
    </div>
  )
}

// ── Pagos ───────────────────────────────────────────────────────────

async function PaymentsTab({ clientId, profile }: { clientId: string; profile: Profile }) {
  const payments = await prisma.coachingPayment.findMany({ where: { clientId }, orderBy: { period: "desc" }, include: { client: { select: { firstName: true, lastName: true } } } })
  const paid = payments.filter((p) => p.status === "PAID")
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Plan" value={<span className="text-base">{profile.planName ?? "—"}</span>} />
        <Stat label="Precio" value={profile.price ? `${profile.currency === "USD" ? "$" : "S/"}${profile.price}` : "—"} hint="por mes" />
        <Stat label="Último pago" value={<span className="text-base">{paid[0]?.paidAt ? formatYmd(toYmd(paid[0].paidAt), true) : "—"}</span>} />
        <Stat label="Total pagado" value={`S/${paid.reduce((a, p) => a + p.amount, 0).toLocaleString("es-PE")}`} tone="green" />
      </div>
      <Panel title="Historial de mensualidades">
        <PaymentsTable
          mpEnabled={mpEnabled()}
          clientId={clientId}
          defaultAmount={profile.price ?? 0}
          payments={payments.map((p) => ({ id: p.id, clientId: p.clientId, clientName: `${p.client.firstName} ${p.client.lastName}`, period: p.period, periodLabel: periodLabel(p.period), amount: p.amount, currency: p.currency, status: p.status, dueDate: toYmd(p.dueDate), paidAt: p.paidAt ? toYmd(p.paidAt) : null, method: p.method }))}
        />
      </Panel>
    </div>
  )
}

// ── Chat ────────────────────────────────────────────────────────────

async function ChatTab({ clientId }: { clientId: string }) {
  const [messages] = await Promise.all([
    prisma.coachMessage.findMany({ where: { clientId }, orderBy: { createdAt: "asc" }, take: 300 }),
    prisma.coachMessage.updateMany({ where: { clientId, sender: "CLIENT", readAt: null }, data: { readAt: new Date() } }),
  ])
  return (
    <Panel className="p-0 overflow-hidden">
      <ChatPanel mode="coach" clientId={clientId} className="h-[65vh]" initialMessages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))} />
    </Panel>
  )
}

// ── Documentos ──────────────────────────────────────────────────────

async function DocumentsTab({ clientId }: { clientId: string }) {
  const docs = await prisma.coachDocument.findMany({ where: { OR: [{ clientId }, { clientId: null }] }, orderBy: { createdAt: "desc" } })
  return (
    <Panel title="Documentos visibles para este cliente">
      <DocumentsManager
        fixedClientId={clientId}
        clients={[]}
        docs={docs.map((d) => ({ id: d.id, title: d.title, description: d.description, category: d.category, type: d.type, url: d.url, clientId: d.clientId, clientName: d.clientId ? null : "Todos", createdAt: dateTimeLima(d.createdAt) }))}
      />
    </Panel>
  )
}

