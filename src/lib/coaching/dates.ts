// Fechas "de calendario" en hora de Lima. Los registros diarios (comidas, agua,
// entrenamientos) se guardan como "YYYY-MM-DD" para no depender de la zona horaria.
export const TZ = "America/Lima"

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function toYmd(date: Date = new Date()): string {
  return ymdFormatter.format(date)
}

export function todayYmd(): string {
  return toYmd(new Date())
}

/** Fecha "YYYY-MM-DD" → Date al mediodía UTC (estable para aritmética de días). */
export function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00Z`)
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = ymdToDate(ymd)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function diffDaysYmd(a: string, b: string): number {
  return Math.round((ymdToDate(a).getTime() - ymdToDate(b).getTime()) / 86_400_000)
}

/** 0 = lunes … 6 = domingo */
export function weekdayYmd(ymd: string): number {
  return (ymdToDate(ymd).getUTCDay() + 6) % 7
}

/** Lunes de la semana de la fecha dada. */
export function weekStartYmd(ymd: string = todayYmd()): string {
  return addDaysYmd(ymd, -weekdayYmd(ymd))
}

export function lastNDays(n: number, end: string = todayYmd()): string[] {
  return Array.from({ length: n }, (_, i) => addDaysYmd(end, i - n + 1))
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

export function formatYmd(ymd: string, withYear = false): string {
  const [y, m, d] = ymd.split("-").map(Number)
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`
}

export function formatYmdLong(ymd: string): string {
  return `${DAYS[weekdayYmd(ymd)]} ${formatYmd(ymd)}`
}

export function currentPeriod(ymd: string = todayYmd()): string {
  return ymd.slice(0, 7)
}

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

export function timeLima(date: Date | string): string {
  return new Intl.DateTimeFormat("es-PE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(date))
}

export function dateTimeLima(date: Date | string): string {
  const d = new Date(date)
  return `${formatYmd(toYmd(d))} ${timeLima(d)}`
}

/** Convierte "YYYY-MM-DD" + "HH:mm" en hora de Lima (UTC-5, sin horario de verano) a Date. */
export function limaDateTime(ymd: string, hhmm: string): Date {
  return new Date(`${ymd}T${hhmm}:00-05:00`)
}
