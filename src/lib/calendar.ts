// ─────────────────────────────────────────────────────────────────────────────
// Fechas de CALENDARIO (un día, sin hora): fecha de una clase, inicio de paquete,
// inicio/fin de membresía, cumpleaños.
//
// Regla única de FORTIA:
//   • Se GUARDAN siempre al mediodía UTC (YYYY-MM-DDT12:00:00Z). Así el día es el
//     mismo en Lima, en UTC y en cualquier navegador.
//   • Se LEEN con calendarYmd(), nunca convirtiendo a otra zona horaria.
//
// La normalización al guardar también la aplica automáticamente el cliente de
// Prisma (src/lib/prisma.ts), así que ninguna pantalla puede guardar un día corrido.
// ─────────────────────────────────────────────────────────────────────────────

const LIMA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" })
const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Campos de la base de datos que son fechas de calendario (se normalizan al guardar). */
export const CALENDAR_FIELDS = new Set(["scheduledDate", "currentPackStart", "membershipStart", "membershipEnd", "birthDate"])

/**
 * Día de calendario ("YYYY-MM-DD") de un valor guardado o recibido.
 * - "YYYY-MM-DD" → tal cual.
 * - Fecha guardada a medianoche UTC (datos antiguos o `new Date("YYYY-MM-DD")`) → su día UTC.
 * - Cualquier otro instante (p. ej. `new Date()` = "ahora") → el día en Lima.
 *   El mediodía UTC cae en el mismo día en Lima, así que también da el día correcto.
 */
export function calendarYmd(value: Date | string): string {
  if (typeof value === "string") {
    if (YMD.test(value)) return value
    value = new Date(value)
  }
  if (Number.isNaN(value.getTime())) throw new Error("Fecha inválida")
  const utcMidnight = value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0 && value.getUTCMilliseconds() === 0
  return utcMidnight ? value.toISOString().slice(0, 10) : LIMA.format(value)
}

/** Valor a guardar para una fecha de calendario: ese día al mediodía UTC. */
export function calendarDate(value: Date | string): Date {
  return new Date(`${calendarYmd(value)}T12:00:00Z`)
}

/** Día de la semana de FORTIA: 0 = lunes … 6 = domingo. */
export function fortiaWeekday(ymd: string): number {
  return (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7
}

export function addCalendarDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Próximas `count` fechas de clase según el horario semanal, desde `fromYmd` (incluido).
 * `weekdays` usa la convención de FORTIA (0 = lunes … 6 = domingo), igual que PersonalTrainingSlot.dayOfWeek.
 */
export function scheduleDates(weekdays: number[], fromYmd: string, count: number): string[] {
  const days = new Set(weekdays)
  const out: string[] = []
  if (!days.size || count <= 0) return out
  let cursor = fromYmd
  for (let i = 0; out.length < count && i < count * 7 + 7; i++) {
    if (days.has(fortiaWeekday(cursor))) out.push(cursor)
    cursor = addCalendarDays(cursor, 1)
  }
  return out
}

/** Normaliza (en el lugar) los campos de calendario de un objeto `data` de Prisma, incluidos los anidados. */
export function normalizeCalendarFields(data: unknown): void {
  if (!data || typeof data !== "object") return
  if (Array.isArray(data)) return data.forEach(normalizeCalendarFields)
  if (data instanceof Date) return
  const obj = data as Record<string, unknown>
  for (const [key, v] of Object.entries(obj)) {
    if (CALENDAR_FIELDS.has(key)) {
      if (v instanceof Date || (typeof v === "string" && v)) obj[key] = calendarDate(v)
      else if (v && typeof v === "object" && "set" in v) {
        const s = (v as { set: unknown }).set
        if (s instanceof Date || (typeof s === "string" && s)) (v as { set: unknown }).set = calendarDate(s)
      }
    } else if (v && typeof v === "object") normalizeCalendarFields(v)
  }
}

/** Fechas (a guardar) de `total` clases según el horario, desde el día de inicio (incluido). */
export function sessionDatesFrom(start: Date | string, slots: { dayOfWeek: number }[], total: number): (Date | null)[] {
  const dates = scheduleDates(slots.map((s) => s.dayOfWeek), calendarYmd(start), total).map(calendarDate)
  return Array.from({ length: total }, (_, i) => dates[i] ?? null)
}
