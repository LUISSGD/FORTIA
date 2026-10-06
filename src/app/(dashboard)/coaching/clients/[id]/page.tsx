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
import { LEVELS, PROFILE_STATUS } from "@/lib/coaching/constants"
import { optionMacros, roundMacros } from "@/lib/coaching/nutrition"
import { fmtKg } from "@/lib/coaching/workout"
import { Panel, Stat, StatusDot } from "@/components/coaching/kit"
import LineChartCard from "@/components/coaching/LineChartCard"
import PhysicalTrackingSection from "@/components/clients/PhysicalTrackingSection"
import ProfileSettings from "./ProfileSettings"
import GoalsPanel from "./GoalsPanel"
import AssignPlan from "@/components/coaching/client-tabs/AssignPlan"
import TrainingTab from "@/components/coaching/client-tabs/TrainingTab"
import CheckInsTab from "@/components/coaching/client-tabs/CheckInsTab"
import ChatTab from "@/components/coaching/client-tabs/ChatTab"
import PhotoCompare from "@/components/coaching/PhotoCompare"
import PaymentsTable from "@/components/coaching/PaymentsTable"
import { mpEnabled } from "@/lib/coaching/mercadopago"
import DocumentsManager from "@/components/coaching/DocumentsManager"
import RenewalBadge from "@/components/clients/RenewalBadge"
import MembershipTab from "./MembershipTab"
import { getMembership, getPersonalTraining } from "@/lib/coaching/personal-training"
import { calendarYmd } from "@/lib/calendar"

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
    include: {
      coachingProfile: true,
      user: { select: { email: true } },
      partnerOf: { select: { id: true, firstName: true, lastName: true, membershipEnd: true } },
      partner: { select: { id: true, firstName: true, lastName: true } },
    },
  })
  if (!client?.coachingProfile) notFound()
  // Pareja: cada uno tiene su ficha; la membresía, el plan EP y los pagos están en la ficha principal
  const couple = client.partnerOf ?? client.partner
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
              <RenewalBadge membershipEnd={(client.partnerOf ?? client).membershipEnd} />
            </h1>
            <p className="text-sm text-gray-500">
              {profile.goal ?? "Sin objetivo"} · {LEVELS[profile.level ?? ""] ?? "—"} · {PROFILE_STATUS[profile.status]}
              {couple && (
                <>
                  {" · "}Pareja de{" "}
                  <Link href={`/coaching/clients/${couple.id}?tab=${tab}`} className="text-orange-600 hover:underline">{couple.firstName.trim()} {couple.lastName.trim()}</Link>
                </>
              )}
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
          {tab === "membership" && client.partnerOf && (
            <p className="mb-4 rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-800">
              La membresía, las clases EP y los pagos son compartidos con su pareja,{" "}
              <Link href={`/coaching/clients/${client.partnerOf.id}?tab=membership`} className="font-medium underline">{client.partnerOf.firstName.trim()} {client.partnerOf.lastName.trim()}</Link>. Lo que cambies aquí aplica a los dos.
            </p>
          )}
          {tab === "membership" && <MembershipTab clientId={client.partnerOfId ?? id} />}
          {tab === "training" && <TrainingTab clientId={id} basePath="/coaching" />}
          {tab === "nutrition" && <NutritionTab clientId={id} profile={profile} />}
          {tab === "progress" && <ProgressTab clientId={id} />}
          {tab === "checkins" && <CheckInsTab clientId={id} />}
          {tab === "payments" && <PaymentsTab clientId={id} profile={profile} />}
          {tab === "chat" && <ChatTab clientId={id} showNutrition nutrition={sp.canal === "nutricion"} />}
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
                birthDate: client.birthDate ? calendarYmd(client.birthDate) : "",
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
            <dt className="text-gray-500">Cumpleaños</dt><dd>{birthDate ? formatYmd(calendarYmd(birthDate)) : "—"}</dd>
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
          action={nutrition ? <Link href={`/nutrition/clients/${clientId}`} className="text-xs text-orange-600">Abrir ficha →</Link> : null}
        >
          {!nutrition ? (
            <p className="text-sm text-gray-500">No tiene ficha en el módulo Nutrición.</p>
          ) : nutrition.consultations.length === 0 ? (
            <p className="text-sm text-gray-500">Sin consultas registradas.</p>
          ) : (
            <ul className="text-sm divide-y divide-gray-100">
              {nutrition.consultations.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">#{c.consultationNumber}</span>
                    <span className="text-gray-400 ml-1">· {formatYmd(c.date.toISOString().slice(0, 10), true)}</span>
                    <div className="text-xs text-gray-400 mt-0.5">{[c.weight && `${c.weight} kg`, c.calTarget && `${Math.round(c.calTarget)} kcal`].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {c.isPaid ? (
                      <span className="inline-block text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                        Pagada{c.paymentAmount ? ` · S/ ${c.paymentAmount}` : ""}
                      </span>
                    ) : (
                      <span className="inline-block text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                        Pendiente
                      </span>
                    )}
                  </div>
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

