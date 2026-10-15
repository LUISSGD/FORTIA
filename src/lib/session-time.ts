// Hora de una clase de entrenamiento personal: la propia de la clase (si se movió o se le puso una)
// o, si no tiene, la del horario semanal del plan para ese día de la semana.
type Slot = { dayOfWeek: number; startTime: string }

const weekday = (ymd: string) => (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7

export function sessionTime(s: { startTime?: string | null; scheduledYmd: string | null }, slots: Slot[]): string | null {
  if (s.startTime) return s.startTime
  if (!s.scheduledYmd) return null
  return slots.find((x) => x.dayOfWeek === weekday(s.scheduledYmd!))?.startTime.slice(0, 5) ?? null
}

/** Valida "HH:MM"; cadena vacía o null → null (usar el horario del plan). undefined → no cambiar. */
export function parseStartTime(v: unknown): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === "") return null
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : undefined
}
