import { calendarYmd } from "@/lib/calendar"
import { addDaysYmd, diffDaysYmd, todayYmd } from "./dates"

// Duración del programa de entrenamiento: la define el coach (4, 6, 8 semanas…),
// no depende del pago ni de la membresía.

export type ProgramDates = { start: string | null; end: string | null; daysLeft: number | null }

/** Último día por defecto: inicio + semanas (8 semanas desde un lunes → domingo de la 8.ª semana). */
export function defaultProgramEnd(startYmd: string, weeks: number): string {
  return addDaysYmd(startYmd, Math.max(1, weeks) * 7 - 1)
}

/** Inicio, fin y días que faltan. El fin guardado manda; si no hay, se calcula con las semanas. */
export function programDates(p: { startDate: Date | null; programEnd: Date | null; weeks: number }, today = todayYmd()): ProgramDates {
  const start = p.startDate ? calendarYmd(p.startDate) : null
  const end = p.programEnd ? calendarYmd(p.programEnd) : start ? defaultProgramEnd(start, p.weeks) : null
  return { start, end, daysLeft: end ? diffDaysYmd(end, today) : null }
}

/** Texto corto: "Termina hoy", "Termina en 5 días", "Terminó hace 3 días". */
export function programEndLabel(daysLeft: number): string {
  if (daysLeft === 0) return "Termina hoy"
  if (daysLeft === 1) return "Termina mañana"
  if (daysLeft > 0) return `Termina en ${daysLeft} días`
  if (daysLeft === -1) return "Terminó ayer"
  return `Terminó hace ${-daysLeft} días`
}

/** Color según lo que falta: vencido rojo, ≤7 días naranja, resto gris. */
export function programEndTone(daysLeft: number | null): string {
  if (daysLeft === null) return "text-gray-500"
  if (daysLeft < 0) return "text-red-600"
  if (daysLeft <= 7) return "text-orange-600"
  return "text-gray-500"
}
