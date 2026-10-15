import { prisma } from "@/lib/prisma"
import { calendarDate, calendarYmd } from "@/lib/calendar"
import { TRAINERS } from "@/lib/trainers"

// Clases de prueba: un interesado (todavía no es cliente) con día, hora y entrenador.
// Las agendan el admin y el entrenador; aparecen en las agendas y en la pantalla Hoy.

export const TRIAL_STATUS: Record<string, string> = {
  SCHEDULED: "Agendada",
  ATTENDED: "Asistió",
  NO_SHOW: "No vino",
  CANCELLED: "Cancelada",
}

export type Trial = {
  id: string
  firstName: string
  lastName: string | null
  phone: string | null
  email: string | null
  dni: string | null
  goal: string | null
  notes: string | null
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  durationMin: number
  trainer: string | null
  status: string
  clientId: string | null
  createdByName: string | null
}

type Row = Awaited<ReturnType<typeof prisma.trialClass.findFirst>>

export function serializeTrial(t: NonNullable<Row>): Trial {
  return {
    id: t.id, firstName: t.firstName, lastName: t.lastName, phone: t.phone, email: t.email, dni: t.dni, goal: t.goal, notes: t.notes,
    date: calendarYmd(t.trialDate), startTime: t.startTime, durationMin: t.durationMin, trainer: t.trainer, status: t.status,
    clientId: t.clientId, createdByName: t.createdByName,
  }
}

/** Clases de prueba entre dos días (incluidos), sin las canceladas. */
export async function trialsBetween(fromYmd: string, toYmd: string) {
  const rows = await prisma.trialClass.findMany({
    where: { trialDate: { gte: calendarDate(fromYmd), lte: calendarDate(toYmd) }, status: { not: "CANCELLED" } },
    orderBy: [{ trialDate: "asc" }, { startTime: "asc" }],
  })
  return rows.map(serializeTrial)
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)

/** Valida los datos del formulario. Con `partial`, solo los campos enviados (para editar). */
export function parseTrialInput(body: Record<string, unknown>, partial = false) {
  const data: Record<string, unknown> = {}
  const has = (k: string) => k in body
  if (!partial || has("firstName")) {
    const firstName = text(body.firstName)
    if (!firstName) return { error: "El nombre es obligatorio" } as const
    data.firstName = firstName
  }
  for (const k of ["lastName", "phone", "email", "dni", "goal", "notes"]) if (!partial || has(k)) data[k] = text(body[k])
  if (!partial || has("date")) {
    const date = text(body.date)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Elige el día de la clase" } as const
    data.trialDate = calendarDate(date)
  }
  if (!partial || has("startTime")) {
    const startTime = text(body.startTime)
    if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) return { error: "Elige la hora de la clase" } as const
    data.startTime = startTime
  }
  if (!partial || has("durationMin")) {
    const d = Math.round(Number(body.durationMin) || 60)
    data.durationMin = Math.min(240, Math.max(15, d))
  }
  if (!partial || has("trainer")) {
    const trainer = text(body.trainer)
    if (trainer && !TRAINERS.some((t) => t.name === trainer)) return { error: "Entrenador no válido" } as const
    data.trainer = trainer
  }
  if (has("status")) {
    const status = text(body.status)
    if (!status || !TRIAL_STATUS[status]) return { error: "Estado no válido" } as const
    data.status = status
  }
  return { data } as const
}
