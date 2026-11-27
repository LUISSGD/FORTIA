import { prisma } from "@/lib/prisma"
import { calendarYmd } from "@/lib/calendar"
import { trainingPlanName } from "@/lib/training-pricing"
import { TRAINERS, UNASSIGNED_TRAINER } from "@/lib/trainers"
import { RENEWAL_SELECT, renewalPrice } from "@/lib/finance/renewals"
import { addDaysYmd, diffDaysYmd, todayYmd, toYmd } from "./dates"
import { ptCounts } from "./personal-training"

// Panel de clases personalizadas: cuántas clases le quedan a cada alumno y cómo va su renovación, por entrenador.
// El seguimiento de su renovación se registra en Cobranza → Personalizados (FollowUp kind "PT", ciclo = id del paquete).
// Las faltas ("no asistió") descuentan la clase igual que una asistencia: quedan = total − clases marcadas (ptCounts).

/** Quedan estas clases o menos, o su última clase es en esta cantidad de días o menos: toca renovar. */
export const RENEW_CLASSES = 2
export const RENEW_DAYS = 7
/** Paquetes terminados que se siguen mostrando (sin renovar) durante estos días. */
export const ENDED_DAYS = 45
/** Un paquete nuevo de alguien que ya tuvo otro se marca como "renovó" durante estos días. */
export const RENEWED_DAYS = 14

export type PtState = "ended" | "renew" | "check" | "ok" | "renewed" | "paused"
export type FollowUpInfo = { outcome: string; at: string; promise: string | null } | null

export type PtRow = {
  planId: string
  clientId: string
  name: string
  firstName: string
  trainer: string
  plan: string
  total: number
  used: number
  remaining: number
  noShows: number
  unmarked: number
  next: string | null
  last: string | null
  daysToLast: number | null
  state: PtState
  /** Solo para el administrador */
  price: number | null
  followUp: FollowUpInfo
  /** Solo para el administrador (para escribirle desde Cobranza) */
  phone: string | null
  renewedOn: string | null
}

/** Estado de la renovación según las clases que quedan y la fecha de su última clase (función pura). */
export function ptState(a: { status: string; remaining: number; daysToLast: number | null; renewedOn: string | null }): PtState {
  if (a.status === "COMPLETED") return "ended"
  if (a.status === "PAUSED") return "paused"
  if (a.remaining <= RENEW_CLASSES) return "renew"
  // Su última clase agendada ya pasó y todavía le quedan varias: faltan marcar o agendar clases, no es una renovación
  if (a.daysToLast !== null && a.daysToLast < 0) return "check"
  if (a.daysToLast !== null && a.daysToLast <= RENEW_DAYS) return "renew"
  return a.renewedOn ? "renewed" : "ok"
}

const ORDER: Record<PtState, number> = { ended: 0, renew: 1, check: 2, paused: 3, renewed: 4, ok: 5 }
const clean = (c: { firstName: string; lastName: string }) => `${c.firstName} ${c.lastName}`.replace(/\s+/g, " ").replace(/\s\.$/, "").trim()

export async function getPtPanel({ withMoney }: { withMoney: boolean }) {
  const today = todayYmd()
  const endedSince = new Date(Date.now() - ENDED_DAYS * 86_400_000)
  const plans = await prisma.clientTrainingPlan.findMany({
    where: { OR: [{ status: { in: ["ACTIVE", "PAUSED"] } }, { status: "COMPLETED", updatedAt: { gte: endedSince } }] },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, clientId: true, status: true, createdAt: true, updatedAt: true, numPacks: true, clasesPerPack: true, sessionsCompleted: true,
      tipoEntrenador: true, modalidad: true, tarifa: true,
      sessions: { select: { scheduledDate: true, attended: true, completedAt: true, isRescheduled: true } },
      client: {
        select: {
          id: true, firstName: true, lastName: true, trainer: true, phone: true,
          partner: { select: { firstName: true, lastName: true } },
          ...(withMoney ? RENEWAL_SELECT : {}),
        },
      },
    },
  })
  // Quién ya tuvo un paquete antes (para marcar "renovó")
  const previous = await prisma.clientTrainingPlan.groupBy({ by: ["clientId"], where: { clientId: { in: [...new Set(plans.map((p) => p.clientId))] } }, _count: { _all: true } })
  const planCount = new Map(previous.map((p) => [p.clientId, p._count._all]))

  // Un solo paquete por alumno: el vigente; si no tiene, el último terminado
  const seen = new Set<string>()
  const current = plans
    .sort((a, b) => Number(a.status === "COMPLETED") - Number(b.status === "COMPLETED") || b.createdAt.getTime() - a.createdAt.getTime())
    .filter((p) => (seen.has(p.clientId) ? false : (seen.add(p.clientId), true)))

  const followUps = withMoney
    ? await prisma.followUp.findMany({ where: { kind: "PT", cycleKey: { in: current.map((p) => p.id) }, clientId: { in: current.map((p) => p.clientId) } }, orderBy: { at: "desc" } })
    : []

  const rows: PtRow[] = current.map((p) => {
    const c = p.client
    const { total, used, attended } = ptCounts(p, p.sessions)
    const dated = p.sessions.filter((s) => s.scheduledDate).map((s) => ({ d: calendarYmd(s.scheduledDate!), ok: s.attended ?? (s.completedAt ? true : null) }))
    const pending = dated.filter((s) => s.ok === null).map((s) => s.d).sort()
    const lastAttended = dated.filter((s) => s.ok === true).map((s) => s.d).sort().at(-1) ?? null
    const last = p.status === "COMPLETED" ? lastAttended ?? toYmd(p.updatedAt) : dated.map((s) => s.d).sort().at(-1) ?? null
    const renewedOn = (planCount.get(p.clientId) ?? 0) > 1 && p.status !== "COMPLETED" && toYmd(p.createdAt) >= addDaysYmd(today, -RENEWED_DAYS) ? toYmd(p.createdAt) : null
    const remaining = p.status === "COMPLETED" ? 0 : Math.max(0, total - used)
    void attended
    const daysToLast = last ? diffDaysYmd(last, today) : null
    const f = followUps.find((x) => x.cycleKey === p.id)
    return {
      planId: p.id,
      clientId: c.id,
      name: c.partner ? `${clean(c)} y ${clean(c.partner)}` : clean(c),
      firstName: c.firstName.trim(),
      trainer: c.trainer ?? UNASSIGNED_TRAINER.name,
      plan: trainingPlanName(p),
      total,
      used,
      remaining,
      noShows: dated.filter((s) => s.ok === false).length,
      unmarked: pending.filter((d) => d < today).length,
      next: pending.find((d) => d >= today) ?? null,
      last,
      daysToLast,
      state: ptState({ status: p.status, remaining, daysToLast, renewedOn }),
      price: withMoney && "payments" in c ? renewalPrice(c as unknown as Parameters<typeof renewalPrice>[0]).price : null,
      followUp: f ? { outcome: f.outcome, at: toYmd(f.at), promise: f.promiseDate ? calendarYmd(f.promiseDate) : null } : null,
      phone: withMoney ? c.phone : null,
      renewedOn,
    }
  })

  rows.sort((a, b) => ORDER[a.state] - ORDER[b.state] || (a.state === "ended" ? (b.daysToLast ?? 0) - (a.daysToLast ?? 0) : a.remaining - b.remaining) || a.name.localeCompare(b.name))
  const trainers = [...TRAINERS.map((t) => t.name as string), UNASSIGNED_TRAINER.name].filter((t) => t !== UNASSIGNED_TRAINER.name || rows.some((r) => r.trainer === t))
  return { today, rows, trainers }
}
