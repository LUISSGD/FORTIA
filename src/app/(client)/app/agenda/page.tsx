import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import { addCalendarDays, calendarDate, calendarYmd, fortiaWeekday } from "@/lib/calendar"
import { limaDateTime, todayYmd, toYmd } from "@/lib/coaching/dates"
import AgendaCalendar, { type AgendaEvent } from "@/components/coaching/app/AgendaCalendar"

const time = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false })

/** Agenda del cliente: clases de entrenamiento personal, citas y entrenamientos del mes. */
export default async function ClientAgendaPage({ searchParams }: PageProps<"/app/agenda">) {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const { clientId } = ctx
  const sp = await searchParams
  const today = todayYmd()
  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : today.slice(0, 7)

  // Cuadrícula de lunes a domingo que cubre el mes completo
  const first = `${month}-01`
  const gridStart = addCalendarDays(first, -fortiaWeekday(first))
  const nextMonth = addCalendarDays(first, 31).slice(0, 7) + "-01"
  const lastOfMonth = addCalendarDays(nextMonth, -1)
  const gridEnd = addCalendarDays(lastOfMonth, 6 - fortiaWeekday(lastOfMonth))
  const rangeStart = calendarDate(gridStart)
  const rangeEnd = calendarDate(gridEnd)

  const [sessions, bookings, workouts, program] = await Promise.all([
    prisma.trainingSession.findMany({
      where: { plan: { clientId }, scheduledDate: { gte: rangeStart, lte: rangeEnd } },
      include: { plan: { select: { status: true, scheduleSlots: { select: { dayOfWeek: true, startTime: true, endTime: true } } } } },
      orderBy: { scheduledDate: "asc" },
    }),
    prisma.coachingBooking.findMany({
      where: { clientId, status: { in: ["BOOKED", "WAITLIST", "ATTENDED", "NO_SHOW"] }, slot: { startsAt: { gte: limaDateTime(gridStart, "00:00"), lt: limaDateTime(addCalendarDays(gridEnd, 1), "00:00") } } },
      include: { slot: true },
    }),
    prisma.workoutLog.findMany({ where: { clientId, completedAt: { not: null }, date: { gte: gridStart, lte: gridEnd } }, select: { date: true, dayName: true, programDayId: true } }),
    prisma.program.findFirst({
      where: { clientId, isActive: true, isTemplate: false },
      select: { days: { orderBy: { order: "asc" }, select: { id: true, name: true, dayOfWeek: true, exercises: { orderBy: { order: "asc" }, select: { sets: true, reps: true, exercise: { select: { name: true } } } } } } },
    }),
  ])

  const events: AgendaEvent[] = []

  // Clases de entrenamiento personal (la fecha de la clase es siempre scheduledDate)
  for (const s of sessions) {
    if (s.plan.status === "CANCELLED") continue
    const date = calendarYmd(s.scheduledDate!)
    const slot = s.plan.scheduleSlots.find((x) => x.dayOfWeek === fortiaWeekday(date))
    events.push({
      date,
      kind: "ep",
      title: `Clase personalizada ${s.isRescheduled ? "(reprogramada)" : `${s.sessionNumber}`}`,
      time: slot ? `${slot.startTime.slice(0, 5)} – ${slot.endTime.slice(0, 5)}` : null,
      status: s.attended === true || (s.attended === null && s.completedAt) ? "done" : s.attended === false ? "missed" : date < today ? "pending-past" : "pending",
    })
  }

  // Citas reservadas (coach o nutricionista)
  for (const b of bookings) {
    const nutrition = b.slot.type === "NUTRITION"
    events.push({
      date: toYmd(b.slot.startsAt),
      kind: nutrition ? "nutri" : "cita",
      title: nutrition ? "Cita con tu nutricionista" : b.slot.title || "Sesión con tu coach",
      time: `${time.format(b.slot.startsAt)} – ${time.format(b.slot.endsAt)}`,
      status: b.status === "ATTENDED" ? "done" : b.status === "NO_SHOW" ? "missed" : b.status === "WAITLIST" ? "waitlist" : "pending",
      detail: b.slot.mode === "VIRTUAL" ? "Virtual" : b.slot.location ?? null,
    })
  }

  // Entrenamientos: hechos (registrados en la app) y planificados según los días de su rutina
  const days = program?.days ?? []
  const exercisesOf = (day?: (typeof days)[number]) => day?.exercises.map((e) => ({ name: e.exercise.name, sets: e.sets, reps: e.reps })) ?? []
  const doneDates = new Set(workouts.map((w) => w.date))
  for (const w of workouts) {
    const day = days.find((d) => d.id === w.programDayId)
    events.push({ date: w.date, kind: "workout", title: w.dayName, time: null, status: "done", dayId: day?.id ?? null, exercises: exercisesOf(day) })
  }
  const planned = days.filter((d) => d.dayOfWeek !== null)
  if (planned.length) {
    for (let d = today > gridStart ? today : gridStart; d <= gridEnd; d = addCalendarDays(d, 1)) {
      if (doneDates.has(d)) continue
      for (const day of planned.filter((p) => p.dayOfWeek === fortiaWeekday(d))) {
        events.push({ date: d, kind: "workout", title: day.name, time: null, status: "pending", dayId: day.id, exercises: exercisesOf(day) })
      }
    }
  }

  return <AgendaCalendar month={month} today={today} gridStart={gridStart} gridEnd={gridEnd} events={events} initialDay={typeof sp.dia === "string" ? sp.dia : null} />
}
