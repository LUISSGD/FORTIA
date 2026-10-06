import { prisma } from "@/lib/prisma"
import { addDaysYmd, diffDaysYmd, formatYmd, timeLima, todayYmd, toYmd, weekdayYmd, weekStartYmd } from "./dates"
import { fillTemplate, notifyClient, sendCoachMessage } from "./notify"
import { calendarYmd } from "@/lib/calendar"

export const AUTOMATION_DEFAULTS: Record<string, { label: string; description: string; days: number | null; channel: string; message: string }> = {
  INACTIVITY: {
    label: "Cliente sin entrenar",
    description: "Se envía cuando el cliente lleva N días sin completar un entrenamiento.",
    days: 4,
    channel: "CHAT",
    message: "¡Hola {nombre}! Noté que llevas {dias} días sin entrenar. ¿Todo bien? 💪",
  },
  WEEK_COMPLETED: {
    label: "Semana completada",
    description: "Cuando el cliente completa todos sus entrenamientos de la semana.",
    days: null,
    channel: "NOTIFICATION",
    message: "🔥 ¡Semana completada, {nombre}! Cumpliste tus {entrenos} entrenamientos.",
  },
  BIRTHDAY: {
    label: "Cumpleaños",
    description: "El día del cumpleaños del cliente (usa la fecha de nacimiento de su ficha).",
    days: null,
    channel: "CHAT",
    message: "🎂 ¡Feliz cumpleaños, {nombre}! Que este año sea el más fuerte de todos. 💪",
  },
  WORKOUT_READY: {
    label: "Entrenamiento del día",
    description: "Aviso diario cuando el programa tiene un día asignado para hoy.",
    days: null,
    channel: "NOTIFICATION",
    message: "Tu entrenamiento de hoy está listo: {entreno}. ¡A darle! 🏋️",
  },
  NUTRITION_REMINDER: {
    label: "Recordatorio de nutrición",
    description: "Si el cliente no registró ninguna comida el día anterior.",
    days: null,
    channel: "NOTIFICATION",
    message: "No olvides registrar tus comidas de hoy, {nombre}. 🥗",
  },
  CHECKIN_REMINDER: {
    label: "Check-in semanal",
    description: "Los domingos, si el cliente aún no envió el check-in de la semana.",
    days: null,
    channel: "NOTIFICATION",
    message: "Tu check-in semanal está pendiente. Te toma 2 minutos. 📝",
  },
  BOOKING_REMINDER: {
    label: "Recordatorio de sesión",
    description: "El día anterior a una sesión reservada.",
    days: null,
    channel: "NOTIFICATION",
    message: "Tu sesión es mañana a las {hora}. ¡Te espero! 📅",
  },
  PAYMENT_REMINDER: {
    label: "Recordatorio de pago",
    description: "N días antes del vencimiento de la mensualidad.",
    days: 3,
    channel: "NOTIFICATION",
    message: "Hola {nombre}, tu mensualidad de {monto} vence el {fecha}. ¡Gracias! 🙌",
  },
}

export async function ensureAutomationRules() {
  const existing = await prisma.automationRule.findMany()
  const missing = Object.entries(AUTOMATION_DEFAULTS).filter(([type]) => !existing.some((r) => r.type === type))
  if (missing.length) {
    await prisma.automationRule.createMany({
      data: missing.map(([type, d]) => ({ type, days: d.days, channel: d.channel, message: d.message, enabled: true })),
      skipDuplicates: true,
    })
    return prisma.automationRule.findMany()
  }
  return existing
}

type Rule = { id: string; type: string; enabled: boolean; days: number | null; channel: string; message: string }

/** Registra la clave y envía. Devuelve false si ya se había enviado (dedupe). */
async function fire(rule: Rule, clientId: string, key: string, vars: Record<string, string | number>, title: string, link: string) {
  try {
    await prisma.automationLog.create({ data: { ruleId: rule.id, clientId, key } })
  } catch {
    return false
  }
  const text = fillTemplate(rule.message, vars)
  if (rule.channel === "CHAT") await sendCoachMessage(clientId, text, "SYSTEM")
  else await notifyClient(clientId, { type: rule.type, title, body: text, link })
  return true
}

/** Se llama al completar un entrenamiento: dispara "semana completada" si corresponde. */
export async function checkWeekCompleted(clientId: string) {
  const rule = await prisma.automationRule.findUnique({ where: { type: "WEEK_COMPLETED" } })
  if (!rule?.enabled) return
  const profile = await prisma.coachingProfile.findUnique({ where: { clientId }, include: { client: { select: { firstName: true } } } })
  if (!profile) return
  const ws = weekStartYmd()
  const done = await prisma.workoutLog.count({ where: { clientId, completedAt: { not: null }, date: { gte: ws } } })
  if (done >= profile.trainingDays) {
    await fire(rule, clientId, `WEEK_COMPLETED:${clientId}:${ws}`, { nombre: profile.client.firstName, entrenos: done }, "¡Semana completada!", "/app/training")
  }
}

/** Ejecuta todas las automatizaciones activas. Idempotente por día gracias a AutomationLog.key. */
export async function runAutomations() {
  const rules = (await ensureAutomationRules()).filter((r) => r.enabled)
  const byType = new Map(rules.map((r) => [r.type, r]))
  const today = todayYmd()
  const yesterday = addDaysYmd(today, -1)
  const tomorrow = addDaysYmd(today, 1)
  const ws = weekStartYmd(today)
  let sent = 0

  const profiles = await prisma.coachingProfile.findMany({
    where: { status: "ACTIVE", client: { user: { isNot: null } } },
    include: {
      client: {
        select: {
          id: true, firstName: true, birthDate: true,
          programs: { where: { isActive: true, isTemplate: false }, select: { days: { select: { name: true, dayOfWeek: true } } }, take: 1 },
          mealPlans: { where: { isActive: true }, select: { id: true }, take: 1 },
        },
      },
    },
  })

  for (const p of profiles) {
    const c = p.client
    const vars = { nombre: c.firstName }

    const inactivity = byType.get("INACTIVITY")
    if (inactivity) {
      const last = await prisma.workoutLog.findFirst({ where: { clientId: c.id, completedAt: { not: null } }, orderBy: { date: "desc" }, select: { date: true } })
      const ref = last?.date ?? toYmd(p.startDate)
      const days = diffDaysYmd(today, ref)
      if (days >= (inactivity.days ?? 4)) {
        if (await fire(inactivity, c.id, `INACTIVITY:${c.id}:${ref}`, { ...vars, dias: days }, "Te extrañamos 💪", "/app/training")) sent++
      }
    }

    const birthday = byType.get("BIRTHDAY")
    if (birthday && c.birthDate && calendarYmd(c.birthDate).slice(5) === today.slice(5)) {
      if (await fire(birthday, c.id, `BIRTHDAY:${c.id}:${today.slice(0, 4)}`, vars, "¡Feliz cumpleaños! 🎂", "/app")) sent++
    }

    const ready = byType.get("WORKOUT_READY")
    const todayDay = c.programs[0]?.days.find((d) => d.dayOfWeek === weekdayYmd(today))
    if (ready && todayDay) {
      if (await fire(ready, c.id, `WORKOUT_READY:${c.id}:${today}`, { ...vars, entreno: todayDay.name }, "Entrenamiento de hoy", "/app/training")) sent++
    }

    const nutrition = byType.get("NUTRITION_REMINDER")
    if (nutrition && c.mealPlans.length && diffDaysYmd(today, toYmd(p.startDate)) >= 2) {
      const logged = await prisma.mealLog.count({ where: { clientId: c.id, date: yesterday } })
      if (!logged && (await fire(nutrition, c.id, `NUTRITION_REMINDER:${c.id}:${today}`, vars, "Nutrición", "/app/nutrition"))) sent++
    }

    const checkin = byType.get("CHECKIN_REMINDER")
    if (checkin && weekdayYmd(today) === 6) {
      const has = await prisma.checkIn.findUnique({ where: { clientId_weekStart: { clientId: c.id, weekStart: ws } } })
      if (!has && (await fire(checkin, c.id, `CHECKIN_REMINDER:${c.id}:${ws}`, vars, "Check-in semanal", "/app/checkin"))) sent++
    }

    const week = byType.get("WEEK_COMPLETED")
    if (week) await checkWeekCompleted(c.id)
  }

  const booking = byType.get("BOOKING_REMINDER")
  if (booking) {
    const bookings = await prisma.coachingBooking.findMany({
      where: { status: "BOOKED", slot: { startsAt: { gte: new Date(`${tomorrow}T00:00:00-05:00`), lt: new Date(`${addDaysYmd(tomorrow, 1)}T00:00:00-05:00`) } } },
      include: { slot: true, client: { select: { firstName: true } } },
    })
    for (const b of bookings) {
      if (await fire(booking, b.clientId, `BOOKING_REMINDER:${b.id}`, { nombre: b.client.firstName, hora: timeLima(b.slot.startsAt) }, "Recordatorio de sesión", "/app/bookings")) sent++
    }
  }

  const payment = byType.get("PAYMENT_REMINDER")
  if (payment) {
    const limit = addDaysYmd(today, payment.days ?? 3)
    const pending = await prisma.coachingPayment.findMany({
      where: { status: "PENDING", dueDate: { gte: new Date(`${today}T00:00:00-05:00`), lte: new Date(`${limit}T23:59:59-05:00`) } },
      include: { client: { select: { firstName: true } } },
    })
    for (const pay of pending) {
      const vars = { nombre: pay.client.firstName, monto: `${pay.currency === "USD" ? "$" : "S/"} ${pay.amount.toFixed(0)}`, fecha: formatYmd(toYmd(pay.dueDate)) }
      if (await fire(payment, pay.clientId, `PAYMENT_REMINDER:${pay.id}`, vars, "Recordatorio de pago", "/app/profile")) sent++
    }
  }

  return { sent, clients: profiles.length }
}
