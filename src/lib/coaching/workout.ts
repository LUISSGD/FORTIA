/** 1RM estimado (Epley). */
export function estimate1RM(weight: number, reps: number) {
  if (!weight || !reps) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

export type SetLike = { weight: number | null; reps: number | null; completed?: boolean }

export function setsVolume(sets: SetLike[]) {
  return sets.reduce((a, s) => a + (s.completed === false ? 0 : (s.weight ?? 0) * (s.reps ?? 0)), 0)
}

export function formatSet(s: SetLike) {
  if (s.weight && s.reps) return `${fmtKg(s.weight)} kg × ${s.reps}`
  if (s.reps) return `${s.reps} reps`
  return "—"
}

export function fmtKg(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "")
}

/** Siguiente día del programa: rota según el último día completado. */
export function nextProgramDay<T extends { id: string; order: number; dayOfWeek: number | null }>(
  days: T[],
  lastDayId: string | null,
  todayWeekday: number
): T | null {
  if (!days.length) return null
  const sorted = [...days].sort((a, b) => a.order - b.order)
  const scheduledToday = sorted.find((d) => d.dayOfWeek === todayWeekday)
  if (scheduledToday && scheduledToday.id !== lastDayId) return scheduledToday
  if (!lastDayId) return sorted[0]
  const idx = sorted.findIndex((d) => d.id === lastDayId)
  return sorted[(idx + 1) % sorted.length]
}
