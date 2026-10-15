// Hora de una clase de entrenamiento personal. Regla:
//   1. la propia de la clase, si se le puso una al moverla o reprogramarla;
//   2. si no, la del horario semanal del plan para ese día de la semana;
//   3. si ese día no está en el horario (clase movida), la hora estándar del plan.
type Slot = { dayOfWeek: number; startTime: string }

const weekday = (ymd: string) => (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7

/** Hora estándar del plan: la que más se repite en su horario semanal. */
export function defaultPlanTime(slots: Slot[]): string | null {
  const count = new Map<string, number>()
  for (const s of slots) count.set(s.startTime.slice(0, 5), (count.get(s.startTime.slice(0, 5)) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
}

export function sessionTime(s: { startTime?: string | null; scheduledYmd: string | null }, slots: Slot[]): string | null {
  if (s.startTime) return s.startTime
  if (!s.scheduledYmd) return defaultPlanTime(slots)
  return slots.find((x) => x.dayOfWeek === weekday(s.scheduledYmd!))?.startTime.slice(0, 5) ?? defaultPlanTime(slots)
}

/** Valida "HH:MM"; cadena vacía o null → null (usar el horario del plan). undefined → no cambiar. */
export function parseStartTime(v: unknown): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === "") return null
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : undefined
}
