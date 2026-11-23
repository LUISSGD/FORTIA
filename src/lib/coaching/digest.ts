import { prisma } from "@/lib/prisma"
import { addCalendarDays, calendarDate, calendarYmd } from "@/lib/calendar"
import { diffDaysYmd, todayYmd } from "./dates"
import { getClassesBetween, type MonthClass } from "./trainer-month"
import { getLeads } from "./leads"
import { getClientsOverview } from "./stats"
import { getCollections } from "@/lib/finance/collections"
import { programEndLabel } from "./program-dates"
import { notifyAdmin } from "./notify"

// Resumen de la mañana: lo que el dueño debe atender hoy. buildDigest() solo lee; sendDigest() lo notifica una vez al día.

const UNMARKED_DAYS = 7
const RISK_NO_SHOWS = 2
const RISK_NO_SHOW_DAYS = 14
const RISK_STOPPED_DAYS = 10
const STOPPED_LIMIT_DAYS = 45
const OBLIGATION_DAYS = 3

export type Digest = Awaited<ReturnType<typeof buildDigest>>

export async function buildDigest() {
  const today = todayYmd()
  const [collections, classes, leadData, overview, obligations] = await Promise.all([
    getCollections(),
    getClassesBetween(addCalendarDays(today, -RISK_NO_SHOW_DAYS), today),
    getLeads(),
    getClientsOverview(),
    prisma.cashPlanItem.findMany({
      where: { plan: { yearMonth: { gte: today.slice(0, 7) } }, expense: { status: { not: "PAGADO" } }, payBy: { lte: calendarDate(addCalendarDays(today, OBLIGATION_DAYS)) } },
      include: { expense: { select: { concept: true, month: true, year: true, amount: true, currency: true } } },
      orderBy: [{ payBy: "asc" }, { priority: "asc" }],
    }),
  ])

  const toCollect = collections.items.filter((i) => i.step !== "REACTIVATE")
  const todayClasses = classes.filter((c) => c.date === today)
  const unmarked = classes.filter((c) => c.state === "unmarked" && c.date >= addCalendarDays(today, -UNMARKED_DAYS))

  const active = overview.filter((c) => c.status === "ACTIVE")
  return {
    today,
    collect: {
      count: toCollect.length,
      total: toCollect.reduce((s, i) => s + i.amount, 0),
      promises: toCollect.filter((i) => i.step === "PROMISE").length,
      top: toCollect.slice(0, 5).map((i) => ({ clientId: i.clientId, name: i.name, amount: i.amount, daysLeft: i.daysLeft })),
    },
    classes: { today: todayClasses, unmarked },
    leads: leadData.leads.filter((l) => l.alert),
    risk: findAtRisk(active, classes),
    programs: active
      .filter((c) => c.program?.daysLeft != null && c.program.daysLeft <= 7)
      .sort((a, b) => b.program!.daysLeft! - a.program!.daysLeft!)
      .map((c) => ({ id: c.id, name: c.name, label: programEndLabel(c.program!.daysLeft!) })),
    obligations: obligations.map((o) => {
      const payBy = calendarYmd(o.payBy)
      return { id: o.id, concept: o.expense.concept, month: o.expense.month, year: o.expense.year, amount: o.expense.amount, currency: o.expense.currency, payBy, daysLeft: diffDaysYmd(payBy, today) }
    }),
  }
}

/**
 * Alumnos en riesgo con señales confiables. No se usa la alerta "días sin entrenar" de todos: muchos entrenan
 * sin registrarlo en la app y saldrían casi todos.
 */
export function findAtRisk(
  active: { id: string; name: string; lastWorkout: string | null; daysSinceWorkout: number | null }[],
  classes: Pick<MonthClass, "kind" | "state" | "clientId">[],
): { id: string; name: string; reason: string }[] {
  const noShows = new Map<string, number>()
  for (const c of classes) if (c.kind === "ep" && c.state === "noShow" && c.clientId) noShows.set(c.clientId, (noShows.get(c.clientId) ?? 0) + 1)
  return active.flatMap((c) => {
    const missed = noShows.get(c.id) ?? 0
    if (missed >= RISK_NO_SHOWS) return [{ id: c.id, name: c.name, reason: `Faltó a ${missed} clases en 2 semanas` }]
    const d = c.daysSinceWorkout
    if (c.lastWorkout && d !== null && d >= RISK_STOPPED_DAYS && d <= STOPPED_LIMIT_DAYS) return [{ id: c.id, name: c.name, reason: `Dejó de registrar sus entrenamientos hace ${d} días` }]
    return []
  })
}

/** Texto de la notificación: solo cantidades, porque se ve en la pantalla bloqueada. */
export function digestText(d: { collect: { count: number; promises: number }; classes: { today: unknown[]; unmarked: unknown[] }; leads: unknown[]; risk: unknown[]; obligations: unknown[] }): string {
  const n = (count: number, one: string, many: string) => (count ? `${count} ${count === 1 ? one : many}` : null)
  const parts = [
    n(d.collect.count, "por cobrar", "por cobrar"),
    n(d.collect.promises, "promesa de pago", "promesas de pago"),
    n(d.classes.today.length, "clase", "clases"),
    n(d.classes.unmarked.length, "clase sin marcar", "clases sin marcar"),
    n(d.leads.length, "interesado por atender", "interesados por atender"),
    n(d.risk.length, "alumno en riesgo", "alumnos en riesgo"),
    n(d.obligations.length, "pago por vencer", "pagos por vencer"),
  ].filter(Boolean)
  return parts.length ? parts.join(" · ") : "Todo al día 🎉"
}

/** Envía el resumen al administrador, una sola vez por día. */
export async function sendDigest(): Promise<{ sent: boolean }> {
  const ymd = todayYmd()
  const digest = await buildDigest()
  // La clave del día evita el doble envío aunque el cron se repita
  const claimed = await prisma.dailyDigest.createMany({ data: [{ ymd }], skipDuplicates: true })
  if (!claimed.count) return { sent: false }
  try {
    await notifyAdmin({ type: "DIGEST", title: "☀️ Tu resumen de hoy", body: digestText(digest), link: "/coaching/hoy" })
  } catch (e) {
    await prisma.dailyDigest.deleteMany({ where: { ymd } })
    throw e
  }
  return { sent: true }
}

