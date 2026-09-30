import Link from "next/link"
import { AlertTriangle, Bell, Calendar, ClipboardCheck, Ticket } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getClientsOverview } from "@/lib/coaching/stats"
import { dateTimeLima, todayYmd, weekStartYmd } from "@/lib/coaching/dates"
import { Panel, Stat } from "@/components/coaching/kit"
import DashboardActions from "./DashboardActions"
import AttentionList from "./AttentionList"
import { withCoachErrors } from "@/components/coaching/withCoachErrors"

export const dynamic = "force-dynamic"

async function CoachingDashboard() {
  const weekStart = weekStartYmd()
  const [allClients, libraryCount, notifications, pendingCheckIns, upcoming] = await Promise.all([
    getClientsOverview(),
    prisma.exercise.count(),
    prisma.notification.findMany({ where: { audience: "COACH" }, orderBy: { createdAt: "desc" }, take: 12, include: { client: { select: { firstName: true } } } }),
    prisma.checkIn.findMany({
      where: { reviewedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.coachingBooking.findMany({
      where: { status: "BOOKED", slot: { startsAt: { gte: new Date(), lt: new Date(Date.now() + 2 * 86_400_000) } } },
      include: { slot: true, client: { select: { firstName: true, lastName: true } } },
      orderBy: { slot: { startsAt: "asc" } },
    }),
  ])

  // Los clientes en stand-by (ex clientes) no cuentan en el panel.
  const overview = allClients.filter((c) => c.status !== "STANDBY")
  const active = overview.filter((c) => c.status === "ACTIVE")
  const green = active.filter((c) => c.level === "green").length
  const yellow = active.filter((c) => c.level === "yellow").length
  const red = active.filter((c) => c.level === "red").length
  const workoutsWeek = overview.reduce((a, c) => a + c.workoutsThisWeek, 0)
  const adherenceValues = active.map((c) => c.trainingAdherence).filter((v): v is number => v !== null)
  const avgAdherence = adherenceValues.length ? Math.round(adherenceValues.reduce((a, b) => a + b, 0) / adherenceValues.length) : null
  const checkInsWeek = active.filter((c) => c.lastCheckIn === weekStart).length
  // Por cobrar: mensualidades de coaching pendientes + membresías vencidas o por vencer.
  const pendingPayments = overview.filter((c) => ["overdue", "pending", "soon"].includes(c.payState)).length
  const renewals = overview
    .filter((c) => c.membership.daysLeft !== null && c.membership.daysLeft <= 7 && c.membership.daysLeft >= -30)
    .sort((a, b) => a.membership.daysLeft! - b.membership.daysLeft!)
  // Último paquete de entrenamiento personal de cada cliente: le queda 1 clase o lo terminó hace poco (sin renovar).
  const ptPlans = await prisma.clientTrainingPlan.findMany({
    where: { status: { in: ["ACTIVE", "COMPLETED"] }, clientId: { in: overview.filter((c) => c.status !== "PAUSED").map((c) => c.id) } },
    select: { clientId: true, status: true, updatedAt: true, numPacks: true, clasesPerPack: true, sessionsCompleted: true, client: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  })
  const latestByClient = new Map<string, (typeof ptPlans)[number]>()
  for (const p of ptPlans) if (!latestByClient.has(p.clientId)) latestByClient.set(p.clientId, p)
  const ptEnding = [...latestByClient.values()].filter((p) =>
    p.status === "ACTIVE"
      ? p.numPacks * p.clasesPerPack - p.sessionsCompleted <= 1
      : p.sessionsCompleted >= p.numPacks * p.clasesPerPack && Date.now() - p.updatedAt.getTime() < 30 * 86_400_000,
  )
  const unread = overview.reduce((a, c) => a + c.unreadMessages, 0)
  const attention = overview.filter((c) => c.level !== "green").sort((a, b) => (a.level === b.level ? b.alerts.length - a.alerts.length : a.level === "red" ? -1 : 1))

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Hola, coach</h1>
          <p className="text-sm text-gray-500">
            {overview.length} clientes en coaching · hoy {todayYmd().split("-").reverse().join("/")}
          </p>
        </div>
        <DashboardActions libraryEmpty={libraryCount === 0} />
      </div>

      {overview.length === 0 ? (
        <Panel>
          <div className="text-center py-8 space-y-2">
            <p className="text-4xl font-bold text-gray-200">F</p>
            <p className="font-semibold">Empieza tu coaching</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              1) Carga la biblioteca base de ejercicios y alimentos. 2) Da de alta a tus clientes y crea su acceso a la app. 3) Asígnales una rutina y un plan nutricional.
            </p>
            <Link href="/coaching/clients" className="inline-block mt-2 text-sm font-medium text-gray-900 underline hover:no-underline">
              Ir a clientes →
            </Link>
          </div>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Stat label="Clientes activos" value={active.length} hint={`${overview.length - active.length} pausados`} />
            <Stat label="Entrenamientos esta semana" value={workoutsWeek} tone="orange" />
            <Stat label="Cumplimiento promedio" value={avgAdherence === null ? "—" : `${avgAdherence}%`} hint="entreno últimos 7 días" tone={avgAdherence !== null && avgAdherence >= 75 ? "green" : "yellow"} />
            <Stat label="Check-ins completados" value={`${checkInsWeek}/${active.length}`} hint="esta semana" />
            <Stat label="Pagos por cobrar" value={pendingPayments} hint="membresías y mensualidades" tone={pendingPayments ? "red" : "green"} />
            <Stat label="Mensajes sin leer" value={unread} tone={unread ? "orange" : "default"} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{green}</p>
              <p className="text-xs text-emerald-600 mt-0.5">Al día</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{yellow}</p>
              <p className="text-xs text-amber-600 mt-0.5">Necesitan atención</p>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{red}</p>
              <p className="text-xs text-red-600 mt-0.5">En riesgo</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <Panel title={<span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" />Clientes que requieren atención</span>} className="lg:col-span-2">
              <AttentionList clients={attention} />
            </Panel>

            <div className="space-y-4">
              <Panel title={<span className="flex items-center gap-1.5"><Ticket className="h-3.5 w-3.5 text-gray-400" />Renovaciones</span>} action={<Link href="/coaching/clients" className="text-xs text-gray-500 hover:text-gray-900">Clientes →</Link>}>
                {renewals.length === 0 && ptEnding.length === 0 ? (
                  <p className="text-sm text-gray-500">Nada por renovar esta semana ✅</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {renewals.map((c) => (
                      <li key={c.id}>
                        <Link href={`/coaching/clients/${c.id}?tab=membership`} className="flex items-center justify-between py-2 hover:bg-gray-50 -mx-2 px-2 rounded">
                          <span className="text-sm font-medium">{c.name}</span>
                          <span className={`text-xs ${c.membership.daysLeft! < 0 ? "text-red-600 font-medium" : "text-amber-600"}`}>
                            {c.membership.daysLeft! < 0 ? `Vencida hace ${-c.membership.daysLeft!} d` : c.membership.daysLeft === 0 ? "Vence hoy" : `Vence en ${c.membership.daysLeft} d`}
                          </span>
                        </Link>
                      </li>
                    ))}
                    {ptEnding.map((p) => {
                      const left = p.numPacks * p.clasesPerPack - p.sessionsCompleted
                      return (
                        <li key={`pt-${p.clientId}`}>
                          <Link href={`/coaching/clients/${p.clientId}?tab=membership`} className="flex items-center justify-between py-2 hover:bg-gray-50 -mx-2 px-2 rounded">
                            <span className="text-sm font-medium">{p.client.firstName} {p.client.lastName}</span>
                            <span className="text-xs text-sky-700">{left <= 0 ? "Paquete terminado" : "Le queda 1 clase"}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Panel>

              <Panel title={<span className="flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5 text-gray-400" />Check-ins por revisar</span>}>
                {pendingCheckIns.length === 0 ? (
                  <p className="text-sm text-gray-500">Todo revisado ✅</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {pendingCheckIns.map((c) => (
                      <li key={c.id}>
                        <Link href={`/coaching/clients/${c.client.id}?tab=checkins`} className="flex items-center justify-between py-2 hover:bg-gray-50 -mx-2 px-2 rounded">
                          <span className="text-sm font-medium">{c.client.firstName} {c.client.lastName}</span>
                          <span className="text-xs text-gray-500">
                            E:{c.energy}/5 · N:{c.nutritionAdherence}%{c.discomfort ? " · !" : ""}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title={<span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-gray-400" />Próximas sesiones</span>} action={<Link href="/coaching/agenda" className="text-xs text-gray-500 hover:text-gray-900">Agenda →</Link>}>
                {upcoming.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin sesiones en las próximas 48 h.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {upcoming.map((b) => (
                      <li key={b.id} className="text-sm flex justify-between">
                        <span>{b.client.firstName} {b.client.lastName}</span>
                        <span className="text-gray-500">{dateTimeLima(b.slot.startsAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>

          <Panel title={<span className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5 text-gray-400" />Actividad reciente</span>}>
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-500">Aquí verás cuando tus clientes entrenen, envíen check-ins, reserven o te escriban.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link href={n.link ?? "#"} className="flex items-start gap-3 py-2 hover:bg-gray-50 -mx-2 px-2 rounded">
                      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.readAt ? "bg-gray-200" : "bg-orange-500"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        {n.body && <p className="text-xs text-gray-500 truncate">{n.body}</p>}
                      </div>
                      <span className="text-[11px] text-gray-400 shrink-0">{dateTimeLima(n.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </>
  )
}

export default withCoachErrors("Dashboard de coaching", CoachingDashboard)
