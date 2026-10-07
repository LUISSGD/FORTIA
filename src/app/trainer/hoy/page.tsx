import Link from "next/link"
import { AlertTriangle, CheckSquare, MessageSquare, Play, Video, MapPin } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { requireTrainerPage } from "@/lib/coaching/auth"
import { calendarDate, fortiaWeekday } from "@/lib/calendar"
import { limaDateTime, todayYmd, addDaysYmd } from "@/lib/coaching/dates"
import { getTrainingState } from "@/lib/coaching/client-data"
import { withCoachErrors } from "@/components/coaching/withCoachErrors"
import AttendanceButtons from "./AttendanceButtons"

export const dynamic = "force-dynamic"

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const hhmm = (d: Date) => new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false }).format(d)
const fullName = (c: { firstName: string; lastName: string }) => `${c.firstName.trim()} ${c.lastName.trim()}`.replace(/\s+\.$/, "")

type Person = { id: string; firstName: string; lastName: string; coachingProfile: { injuries: string | null } | null }

/** Pantalla de inicio del entrenador: quién viene hoy, qué rutina le toca y qué requiere su atención. */
async function TrainerTodayPage() {
  await requireTrainerPage()
  const today = todayYmd()
  const weekday = fortiaWeekday(today)
  const person = { id: true, firstName: true, lastName: true, coachingProfile: { select: { injuries: true } } } as const

  const [sessions, slots, unread, checkIns] = await Promise.all([
    prisma.trainingSession.findMany({
      where: { scheduledDate: calendarDate(today), plan: { status: { in: ["ACTIVE", "PAUSED"] } } },
      include: {
        plan: {
          select: {
            numPacks: true, clasesPerPack: true, sessionsCompleted: true,
            scheduleSlots: { select: { dayOfWeek: true, startTime: true } },
            client: { select: { ...person, partner: { select: person } } },
          },
        },
      },
    }),
    prisma.coachingSlot.findMany({
      where: { type: "COACHING", startsAt: { gte: limaDateTime(today, "00:00"), lt: limaDateTime(addDaysYmd(today, 1), "00:00") } },
      include: { bookings: { where: { status: { in: ["BOOKED", "ATTENDED", "NO_SHOW"] } }, include: { client: { select: person } } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.coachMessage.groupBy({ by: ["clientId"], where: { channel: "COACHING", sender: "CLIENT", readAt: null }, _count: { _all: true } }),
    prisma.checkIn.groupBy({ by: ["clientId"], where: { reviewedAt: null }, _count: { _all: true } }),
  ])

  // Rutina que le toca a cada persona (en parejas, cada uno la suya)
  const people = new Map<string, Person>()
  for (const s of sessions) {
    people.set(s.plan.client.id, s.plan.client)
    if (s.plan.client.partner) people.set(s.plan.client.partner.id, s.plan.client.partner)
  }
  for (const sl of slots) for (const b of sl.bookings) people.set(b.client.id, b.client)
  const states = new Map(await Promise.all([...people.keys()].map(async (id) => [id, await getTrainingState(id)] as const)))

  const classes = sessions
    .map((s) => {
      const total = s.plan.numPacks * s.plan.clasesPerPack
      return {
        id: s.id,
        number: s.sessionNumber,
        total,
        remaining: total - s.plan.sessionsCompleted,
        attended: s.attended ?? (s.completedAt ? true : null),
        time: s.plan.scheduleSlots.find((x) => x.dayOfWeek === weekday)?.startTime.slice(0, 5) ?? null,
        persons: [s.plan.client, ...(s.plan.client.partner ? [s.plan.client.partner] : [])],
      }
    })
    .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"))

  const attentionIds = [...new Set([...unread.map((u) => u.clientId), ...checkIns.map((c) => c.clientId)])]
  const attentionClients = attentionIds.length
    ? await prisma.client.findMany({ where: { id: { in: attentionIds }, coachingProfile: { status: { in: ["ACTIVE", "PAUSED"] } } }, select: { id: true, firstName: true, lastName: true } })
    : []
  const unreadBy = new Map(unread.map((u) => [u.clientId, u._count._all]))
  const checkInsBy = new Map(checkIns.map((c) => [c.clientId, c._count._all]))

  const [, m, d] = today.split("-").map(Number)
  const pending = classes.filter((c) => c.attended === null).length

  const routine = (p: Person, highlight: boolean) => {
    const st = states.get(p.id)
    const day = st?.nextDay
    return (
      <div key={p.id} className="flex items-center gap-3 py-2">
        <div className="flex-1 min-w-0">
          <Link href={`/trainer/clients/${p.id}`} className="font-semibold text-gray-900 hover:underline">{fullName(p)}</Link>
          {p.coachingProfile?.injuries && (
            <p className="text-xs text-red-600 flex gap-1 items-start"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span className="line-clamp-2">{p.coachingProfile.injuries}</span></p>
          )}
          <p className="text-xs text-gray-500 truncate">
            {st?.doneToday ? `✅ Ya registró hoy: ${st.doneToday.dayName}` : day ? `Le toca: ${day.name} · ${day.exercises.length} ejercicios` : "Sin rutina asignada"}
          </p>
        </div>
        {day && !st?.doneToday && (
          <Link href={`/trainer/clients/${p.id}/workout/${day.id}`} className={cn("shrink-0 flex items-center gap-1.5 rounded-lg px-3 h-9 text-xs font-bold", highlight ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700")}>
            <Play className="h-3.5 w-3.5" /> Registrar
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-orange-500 font-bold">Hoy</p>
        <h1 className="text-2xl font-black text-gray-900">{DAY_NAMES[weekday]} {d} de {MONTHS[m - 1]}</h1>
        <p className="text-sm text-gray-500">
          {classes.length ? `${classes.length} clase${classes.length === 1 ? "" : "s"} personalizada${classes.length === 1 ? "" : "s"}${pending ? ` · ${pending} por marcar` : " · todas marcadas"}` : "Sin clases personalizadas hoy"}
          {slots.length ? ` · ${slots.length} cita${slots.length === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      {classes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Clases personalizadas</h2>
          {classes.map((c) => (
            <div key={c.id} className={cn("rounded-2xl border p-4", c.attended === true ? "border-emerald-200 bg-emerald-50/40" : c.attended === false ? "border-red-200 bg-red-50/40" : "border-gray-200 bg-white")}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-lg font-black text-gray-900">{c.time ?? "Sin hora"}</p>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">Clase {c.number}/{c.total}</span>
                  {c.remaining <= 1 && c.attended === null && (
                    <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">{c.remaining === 1 ? "Última del paquete" : "Paquete agotado"}</span>
                  )}
                </div>
              </div>
              <div className="divide-y divide-gray-100">{c.persons.map((p, i) => routine(p, i === 0 && c.attended !== false))}</div>
              <AttendanceButtons sessionId={c.id} attended={c.attended} />
            </div>
          ))}
        </section>
      )}

      {slots.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Citas de coaching</h2>
          {slots.map((s) => (
            <div key={s.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="font-bold text-gray-900 flex items-center gap-1.5">
                {hhmm(s.startsAt)} · {s.title}
                {s.mode === "ONLINE" ? <Video className="h-3.5 w-3.5 text-gray-400" /> : s.location ? <MapPin className="h-3.5 w-3.5 text-gray-400" /> : null}
              </p>
              {s.bookings.length ? <div className="divide-y divide-gray-100">{s.bookings.map((b) => routine(b.client, false))}</div> : <p className="text-xs text-gray-400 mt-1">Sin reservas</p>}
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Requieren tu atención</h2>
        {attentionClients.length === 0 ? (
          <p className="text-sm text-gray-400">Todo al día: sin mensajes ni check-ins pendientes. 👌</p>
        ) : (
          <ul className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
            {attentionClients.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-4 py-3">
                <span className="flex-1 font-medium text-gray-900 truncate">{fullName(c)}</span>
                {unreadBy.get(c.id) && (
                  <Link href={`/trainer/clients/${c.id}?tab=chat`} className="flex items-center gap-1 rounded-full bg-orange-50 text-orange-700 px-2.5 py-1 text-xs font-semibold">
                    <MessageSquare className="h-3.5 w-3.5" /> {unreadBy.get(c.id)}
                  </Link>
                )}
                {checkInsBy.get(c.id) && (
                  <Link href={`/trainer/clients/${c.id}?tab=checkins`} className="flex items-center gap-1 rounded-full bg-sky-50 text-sky-700 px-2.5 py-1 text-xs font-semibold">
                    <CheckSquare className="h-3.5 w-3.5" /> Check-in
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default withCoachErrors("Hoy", TrainerTodayPage)
