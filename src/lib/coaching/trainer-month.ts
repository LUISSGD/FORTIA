import { prisma } from "@/lib/prisma"
import { addCalendarDays, calendarDate, calendarYmd } from "@/lib/calendar"
import { todayYmd } from "./dates"
import { VISIBLE_SESSIONS } from "./personal-training"
import { sessionTime } from "@/lib/session-time"
import { trainingPlanName } from "@/lib/training-pricing"
import { TRAINERS, UNASSIGNED_TRAINER } from "@/lib/trainers"
import { trialsBetween } from "./trials"

// Clases del mes por entrenador (base de sus comisiones): dadas, no asistió, sin marcar y por dar.
// El entrenador de una clase marcada es el que quedó guardado al marcarla (TrainingSession.trainer);
// si no lo tiene (clases marcadas antes de guardar ese dato) o aún no se marca, el asignado al cliente hoy.

export type ClassState = "given" | "noShow" | "unmarked" | "upcoming"
export type MonthClass = {
  id: string
  kind: "ep" | "trial"
  date: string
  time: string | null
  trainer: string
  client: string
  clientId: string | null
  plan: string
  number: string | null
  couple: boolean
  state: ClassState
}
export type TrainerTotals = { trainer: string; given: number; noShow: number; unmarked: number; upcoming: number; trialsGiven: number }

const name = (c: { firstName: string; lastName: string }) => `${c.firstName.trim()} ${c.lastName.trim()}`.replace(/\s+\.$/, "").trim()

export function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number)
  const first = `${ym}-01`
  const last = new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10)
  return { first, last }
}

export async function getTrainerMonth(ym: string) {
  const { first, last } = monthBounds(ym)
  const today = todayYmd()
  const unassigned = UNASSIGNED_TRAINER.name

  const sessions = await prisma.trainingSession.findMany({
    where: { scheduledDate: { gte: calendarDate(first), lt: calendarDate(addCalendarDays(last, 1)) }, ...VISIBLE_SESSIONS },
    select: {
      id: true, sessionNumber: true, scheduledDate: true, startTime: true, attended: true, completedAt: true, trainer: true, isRescheduled: true,
      plan: {
        select: {
          tipoEntrenador: true, modalidad: true, tarifa: true, numPacks: true, clasesPerPack: true,
          scheduleSlots: { select: { dayOfWeek: true, startTime: true } },
          client: { select: { id: true, firstName: true, lastName: true, trainer: true, partner: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  })

  const classes: MonthClass[] = sessions.map((s) => {
    const date = calendarYmd(s.scheduledDate!)
    const attended = s.attended ?? (s.completedAt ? true : null)
    const state: ClassState = attended === true ? "given" : attended === false ? "noShow" : date < today ? "unmarked" : "upcoming"
    const c = s.plan.client
    return {
      id: s.id,
      kind: "ep",
      date,
      time: sessionTime({ startTime: s.startTime, scheduledYmd: date }, s.plan.scheduleSlots),
      trainer: (attended !== null ? s.trainer : null) ?? c.trainer ?? unassigned,
      client: c.partner ? `${name(c)} y ${name(c.partner)}` : name(c),
      clientId: c.id,
      plan: trainingPlanName(s.plan),
      number: `${s.isRescheduled ? "R" : "S"}${s.sessionNumber}/${s.plan.numPacks * s.plan.clasesPerPack}`,
      couple: !!c.partner,
      state,
    }
  })

  for (const t of await trialsBetween(first, last)) {
    const state: ClassState = t.status === "ATTENDED" ? "given" : t.status === "NO_SHOW" ? "noShow" : t.date < today ? "unmarked" : "upcoming"
    classes.push({
      id: t.id, kind: "trial", date: t.date, time: t.startTime, trainer: t.trainer ?? unassigned,
      client: [t.firstName, t.lastName].filter(Boolean).join(" "), clientId: null, plan: "Clase de prueba", number: null, couple: false, state,
    })
  }
  classes.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99").localeCompare(b.time ?? "99"))

  const names = [...TRAINERS.map((t) => t.name as string), unassigned]
  const totals: TrainerTotals[] = names
    .map((trainer) => {
      const mine = classes.filter((c) => c.trainer === trainer)
      const ep = mine.filter((c) => c.kind === "ep")
      return {
        trainer,
        given: ep.filter((c) => c.state === "given").length,
        noShow: ep.filter((c) => c.state === "noShow").length,
        unmarked: ep.filter((c) => c.state === "unmarked").length,
        upcoming: ep.filter((c) => c.state === "upcoming").length,
        trialsGiven: mine.filter((c) => c.kind === "trial" && c.state === "given").length,
      }
    })
    .filter((t) => t.trainer !== unassigned || t.given + t.noShow + t.unmarked + t.upcoming + t.trialsGiven > 0)

  return { ym, first, last, today, classes, totals }
}
