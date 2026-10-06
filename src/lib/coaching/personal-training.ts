import { prisma } from "@/lib/prisma"
import { diffDaysYmd, todayYmd, toYmd, ymdToDate } from "./dates"
import { addCalendarDays, calendarDate, calendarYmd, scheduleDates } from "@/lib/calendar"
import { notifyClient, notifyCoach } from "./notify"

// Membresía del gimnasio y entrenamiento personal (paquetes de clases) vistos
// desde el coaching y desde la app del cliente. Usa las mismas tablas que el
// resto de FORTIA (Client.membership*, ClientTrainingPlan, TrainingSession).

export const APP_SESSION_NOTE = "📱 Registrada por el cliente desde la app"

export type MembershipInfo = {
  planName: string | null
  start: string | null
  end: string | null
  daysLeft: number | null
  state: "none" | "expired" | "urgent" | "warning" | "active"
}

export function membershipInfo(c: { membershipStart: Date | null; membershipEnd: Date | null; membershipPlan?: { name: string } | null }): MembershipInfo {
  const end = c.membershipEnd ? calendarYmd(c.membershipEnd) : null
  const daysLeft = end ? diffDaysYmd(end, todayYmd()) : null
  const state = daysLeft === null ? "none" : daysLeft < 0 ? "expired" : daysLeft <= 5 ? "urgent" : daysLeft <= 10 ? "warning" : "active"
  return {
    planName: c.membershipPlan?.name ?? null,
    start: c.membershipStart ? calendarYmd(c.membershipStart) : null,
    end,
    daysLeft,
    state,
  }
}

export async function getMembership(clientId: string) {
  const c = await prisma.client.findUnique({
    where: { id: clientId },
    select: { membershipStart: true, membershipEnd: true, membershipPlan: { select: { name: true } } },
  })
  return c ? membershipInfo(c) : null
}

// ── Fechas de las clases ─────────────────────────────────────────────────────
// Una sola regla para todo FORTIA (ver src/lib/calendar.ts):
//  • La fecha de una clase es SIEMPRE su scheduledDate (día de calendario).
//  • completedAt solo dice cuándo se marcó la asistencia; nunca se muestra como fecha de la clase.

const addDaysDate = (d: Date, days: number) => new Date(d.getTime() + days * 86400000)

/** Fecha ("YYYY-MM-DD") de una clase: su día programado; si no tiene, el día en que se marcó. */
export function sessionYmd(s: { scheduledDate: Date | null; completedAt: Date | null; createdAt: Date }): string {
  return s.scheduledDate ? calendarYmd(s.scheduledDate) : toYmd(s.completedAt ?? s.createdAt)
}

/**
 * Asigna fechas a las clases PENDIENTES según el horario semanal, en orden de número de clase.
 * Empieza en el inicio del paquete (o la fecha indicada), pero nunca antes del día siguiente
 * a la última clase ya asistida, para no pisar el historial.
 */
export async function assignPlanScheduleDates(planId: string, startDate?: Date | string) {
  const [plan, slots] = await Promise.all([
    prisma.clientTrainingPlan.findUnique({ where: { id: planId }, include: { sessions: { orderBy: { sessionNumber: "asc" } } } }),
    prisma.personalTrainingSlot.findMany({ where: { planId } }),
  ])
  if (!plan || slots.length === 0) return

  const pending = plan.sessions.filter((s) => isAttended(s) === null && !s.isRescheduled)
  if (!pending.length) return

  let from = calendarYmd(startDate ?? plan.currentPackStart ?? plan.createdAt)
  const done = plan.sessions.filter((s) => isAttended(s) !== null).map(sessionYmd).sort()
  const lastDone = done.at(-1)
  if (lastDone && lastDone >= from) from = addCalendarDays(lastDone, 1)

  const dates = scheduleDates(slots.map((s) => s.dayOfWeek), from, pending.length)
  await prisma.$transaction(
    pending.map((session, i) => prisma.trainingSession.update({ where: { id: session.id }, data: { scheduledDate: dates[i] ? calendarDate(dates[i]) : null } }))
  )
}

const isAttended = (s: { attended: boolean | null; completedAt: Date | null }) => s.attended ?? (s.completedAt ? true : null)

/** Paquete de entrenamiento personal vigente del cliente (o el último pausado). */
export async function getPersonalTraining(clientId: string) {
  const plan = await prisma.clientTrainingPlan.findFirst({
    where: { clientId, status: { in: ["ACTIVE", "PAUSED"] } },
    include: {
      sessions: { orderBy: [{ isRescheduled: "asc" }, { sessionNumber: "asc" }] },
      scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  })
  if (!plan) return null
  const today = todayYmd()
  const total = plan.numPacks * plan.clasesPerPack
  const used = Math.min(plan.sessionsCompleted, total)
  const attended = plan.sessions
    .filter((s) => isAttended(s) === true)
    .map((s) => ({ id: s.id, date: sessionYmd(s), byClient: s.notes === APP_SESSION_NOTE }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  const todaySession = attended.find((s) => s.date === today) ?? null
  const upcoming = plan.sessions
    .filter((s) => isAttended(s) === null && s.scheduledDate && calendarYmd(s.scheduledDate) >= today)
    .map((s) => calendarYmd(s.scheduledDate!))
    .sort()
    .slice(0, 3)
  return {
    id: plan.id,
    status: plan.status,
    modalidad: plan.modalidad,
    tipoEntrenador: plan.tipoEntrenador,
    total,
    used,
    remaining: Math.max(0, total - used),
    startedAt: plan.currentPackStart ? calendarYmd(plan.currentPackStart) : toYmd(plan.createdAt),
    schedule: plan.scheduleSlots.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })),
    attended,
    todaySession,
    canUndoToday: !!todaySession?.byClient,
    upcoming,
  }
}

export type PersonalTraining = NonNullable<Awaited<ReturnType<typeof getPersonalTraining>>>

class PTError extends Error {}

/** El cliente marca desde la app que hoy fue a su clase personalizada. */
export async function registerClientSession(clientId: string) {
  const today = todayYmd()
  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.clientTrainingPlan.findFirst({
      where: { clientId, status: "ACTIVE" },
      include: { sessions: true },
      orderBy: { createdAt: "desc" },
    })
    if (!plan) throw new PTError("No tienes un paquete de entrenamiento personal activo. Habla con tu coach.")
    const total = plan.numPacks * plan.clasesPerPack
    if (plan.sessionsCompleted >= total) throw new PTError("Ya usaste todas las clases de tu paquete. Habla con tu coach para renovarlo.")
    if (plan.sessions.some((s) => isAttended(s) === true && sessionYmd(s) === today)) {
      throw new PTError("Tu clase de hoy ya está registrada ✅")
    }

    // Sesión a marcar: la programada para hoy; si no, la siguiente pendiente.
    const pending = plan.sessions
      .filter((s) => isAttended(s) === null)
      .sort((a, b) => Number(a.isRescheduled) - Number(b.isRescheduled) || a.sessionNumber - b.sessionNumber)
    let target = pending.find((s) => s.scheduledDate && calendarYmd(s.scheduledDate) === today) ?? pending[0]
    if (!target) {
      // Planes antiguos sin sesiones generadas: se crea el registro que falta.
      const used = new Set(plan.sessions.filter((s) => !s.isRescheduled).map((s) => s.sessionNumber))
      let n = 1
      while (used.has(n)) n++
      target = await tx.trainingSession.create({
        data: { planId: plan.id, sessionNumber: n, packNumber: Math.min(plan.numPacks, Math.floor((n - 1) / plan.clasesPerPack) + 1) },
      })
    }

    await tx.trainingSession.update({
      where: { id: target.id },
      data: { attended: true, completedAt: new Date(), scheduledDate: ymdToDate(today), notes: APP_SESSION_NOTE },
    })
    const sessionsCompleted = plan.sessionsCompleted + 1
    await tx.clientTrainingPlan.update({
      where: { id: plan.id },
      data: { sessionsCompleted, status: sessionsCompleted >= total ? "COMPLETED" : plan.status },
    })
    return { total, used: sessionsCompleted, remaining: total - sessionsCompleted }
  }).catch((e) => {
    if (e instanceof PTError) return { error: e.message }
    throw e
  })
  if ("error" in result) return result

  try {
    const c = await prisma.client.findUnique({ where: { id: clientId }, select: { firstName: true, lastName: true } })
    const name = c ? `${c.firstName} ${c.lastName}` : "Un cliente"
    await notifyCoach({
      clientId,
      type: "PT_SESSION",
      title: `🏋️ ${name} registró su clase personalizada`,
      body: `Clase ${result.used} de ${result.total} · le quedan ${result.remaining}`,
      link: `/coaching/clients/${clientId}?tab=membership`,
    })
    if (result.remaining <= 1) {
      await notifyCoach({
        clientId,
        type: "PT_RENEWAL",
        title: result.remaining === 0 ? `📦 ${name} terminó su paquete de clases` : `📦 A ${name} le queda 1 clase`,
        body: "Buen momento para ofrecerle la renovación.",
        link: `/coaching/clients/${clientId}?tab=membership`,
      })
      await notifyClient(clientId, {
        type: "PT_RENEWAL",
        title: result.remaining === 0 ? "Completaste tu paquete de clases 🎉" : "Te queda 1 clase en tu paquete",
        body: "Habla con tu coach para renovarlo y no perder el ritmo.",
        link: "/app/personal",
      })
    }
  } catch (e) {
    console.error("[pt] notificación", e)
  }
  return result
}

/** Deshace la clase que el propio cliente registró hoy (por si se equivocó). */
export async function undoClientSession(clientId: string) {
  const today = todayYmd()
  return prisma.$transaction(async (tx) => {
    const plan = await tx.clientTrainingPlan.findFirst({
      where: { clientId, status: { in: ["ACTIVE", "COMPLETED"] }, sessions: { some: { notes: APP_SESSION_NOTE, attended: true } } },
      include: { sessions: { where: { notes: APP_SESSION_NOTE, attended: true } } },
      orderBy: { updatedAt: "desc" },
    })
    const session = plan?.sessions.find((s) => s.completedAt && toYmd(s.completedAt) === today)
    if (!plan || !session) return { error: "Solo puedes deshacer la clase que registraste hoy." }
    await tx.trainingSession.update({ where: { id: session.id }, data: { attended: null, completedAt: null, notes: null } })
    const sessionsCompleted = Math.max(0, plan.sessionsCompleted - 1)
    await tx.clientTrainingPlan.update({
      where: { id: plan.id },
      data: { sessionsCompleted, status: plan.status === "COMPLETED" ? "ACTIVE" : plan.status },
    })
    return { ok: true }
  })
}

/** Clases personalizadas asistidas por cliente desde una fecha (para adherencia y alertas). */
export async function attendedPtDates(clientIds: string[], sinceYmd: string) {
  if (!clientIds.length) return new Map<string, string[]>()
  const since = ymdToDate(sinceYmd)
  const sessions = await prisma.trainingSession.findMany({
    where: {
      plan: { clientId: { in: clientIds } },
      AND: [
        { OR: [{ attended: true }, { attended: null, completedAt: { not: null } }] },
        // La fecha de la clase es scheduledDate; las antiguas sin fecha usan el día en que se marcaron
        { OR: [{ scheduledDate: { gte: addDaysDate(since, -1) } }, { scheduledDate: null, completedAt: { gte: since } }] },
      ],
    },
    select: { scheduledDate: true, completedAt: true, createdAt: true, plan: { select: { clientId: true } } },
  })
  const map = new Map<string, string[]>()
  for (const s of sessions) {
    const ymd = sessionYmd(s)
    if (ymd < sinceYmd) continue
    const list = map.get(s.plan.clientId) ?? []
    list.push(ymd)
    map.set(s.plan.clientId, list)
  }
  return map
}

/** Clases grupales asistidas (Calendario de FORTIA) por cliente desde una fecha. */
export async function attendedClassDates(clientIds: string[], sinceYmd: string) {
  const map = new Map<string, string[]>()
  if (!clientIds.length) return map
  const rows = await prisma.attendance.findMany({
    where: { clientId: { in: clientIds }, attended: true, date: { gte: ymdToDate(sinceYmd) } },
    select: { clientId: true, date: true },
  })
  for (const r of rows) {
    const list = map.get(r.clientId) ?? []
    list.push(r.date.toISOString().slice(0, 10))
    map.set(r.clientId, list)
  }
  return map
}
