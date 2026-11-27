import { prisma } from "@/lib/prisma"
import { startOfMonth, endOfMonth, format } from "date-fns"
import { es } from "date-fns/locale"
import { trainingPlanName } from "@/lib/training-pricing"
import { calendarYmd } from "@/lib/calendar"

// Proyección de renovaciones del mes: clientes cuya membresía vence en el mes y lo que pagaron la última vez.
// La usan la pantalla Proyección y el Plan del mes.

type Pay = { amount: number; concept: string | null; paidAt: Date; balanceDue: number | null; incomeId: string | null; income: { category: string } | null }

/** Total de un pago, contando los saldos ("Saldo — …") ya pagados y el saldo que aún falta. */
function paymentTotal(p: Pay, all: Pay[]) {
  const saldos = all
    .filter((x) => x !== p && x.paidAt >= p.paidAt && /^Saldo( \(parcial\))? — /.test(x.concept ?? "") && x.concept!.endsWith(p.concept ?? "\u0000"))
    .reduce((s, x) => s + x.amount, 0)
  return Math.round((p.amount + saldos + (p.balanceDue ?? 0)) * 100) / 100
}

export function parseYearMonth(month: string | null): { monthStart: Date; monthEnd: Date; yearMonth: string } {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, mm] = month.split("-").map(Number)
    const d = new Date(year, mm - 1, 1)
    return { monthStart: startOfMonth(d), monthEnd: endOfMonth(d), yearMonth: month }
  }
  const now = new Date()
  return {
    monthStart: startOfMonth(now),
    monthEnd: endOfMonth(now),
    yearMonth: format(now, "yyyy-MM"),
  }
}

export type BalanceRow = { paymentId: string; clientId: string; name: string; concept: string; amount: number; dueDate: string | null; overdue: boolean; isTraining: boolean }

/** Todos los saldos pendientes de pagos parciales, del que vence antes al que vence después. */
export async function getAllBalances(): Promise<BalanceRow[]> {
  const today = calendarYmd(new Date())
  const rows = await prisma.payment.findMany({
    where: { balanceDue: { gt: 0 }, balancePaidAt: null },
    select: { id: true, clientId: true, concept: true, balanceDue: true, balanceDueDate: true, client: { select: { firstName: true, lastName: true } }, income: { select: { category: true } } },
    orderBy: { balanceDueDate: "asc" },
  })
  return rows
    .map((p) => {
      const due = p.balanceDueDate ? calendarYmd(p.balanceDueDate) : null
      const name = `${p.client.firstName} ${p.client.lastName}`.replace(/\s+/g, " ").trim()
      // El concepto a veces termina en "— Nombre del cliente": se quita solo esa parte
      const parts = (p.concept ?? "").split(" — ")
      const last = (parts.at(-1) ?? "").replace(/\s+/g, " ").trim().toLowerCase()
      const concept = (parts.length > 1 && last === name.toLowerCase() ? parts.slice(0, -1) : parts).join(" — ").trim()
      return {
        paymentId: p.id,
        clientId: p.clientId,
        name,
        concept: concept || "Pago parcial",
        amount: Math.round((p.balanceDue ?? 0) * 100) / 100,
        dueDate: due,
        overdue: !!due && due < today,
        isTraining: p.income?.category === "PERSONAL_TRAINING",
      }
    })
}

/**
 * Saldos que se esperan cobrar en el mes: los que vencen en el mes y, si es el mes actual, también
 * los ya vencidos que siguen sin pagarse.
 */
async function getPendingBalances(monthStart: Date, monthEnd: Date): Promise<BalanceRow[]> {
  const today = calendarYmd(new Date())
  const first = calendarYmd(monthStart), last = calendarYmd(monthEnd)
  const isCurrent = today >= first && today <= last
  return (await getAllBalances())
    .filter((b) => (b.dueDate ? (b.dueDate >= first && b.dueDate <= last) || (isCurrent && b.dueDate < first) : isCurrent))
}

export type RenewalRow = { id: string; name: string; membershipEnd: Date | null; planName: string; price: number; priceSource: "lastPayment" | "plan"; willSkip: boolean }

/** Campos que necesita renewalPrice(). */
export const RENEWAL_SELECT = {
  membershipPlan: { select: { name: true, price: true } },
  trainingPlans: {
    orderBy: { createdAt: "desc" as const }, take: 1,
    select: { createdAt: true, pricePaid: true, incomeId: true, tipoEntrenador: true, modalidad: true, tarifa: true, numPacks: true, clasesPerPack: true },
  },
  payments: {
    where: { method: { not: "EXTENSION" } },
    orderBy: { paidAt: "desc" as const }, take: 30,
    select: { amount: true, concept: true, paidAt: true, balanceDue: true, incomeId: true, income: { select: { category: true } } },
  },
}

type RenewalSource = {
  membershipPlan: { name: string; price: number } | null
  trainingPlans: { createdAt: Date; pricePaid: number; incomeId: string | null; tipoEntrenador: string; modalidad: string; tarifa: string; numPacks: number; clasesPerPack: number }[]
  payments: Pay[]
}

/**
 * Precio de renovación = lo que pagó la última vez por lo que tiene ahora (paquete EP completo, p. ej. 3 packs,
 * o la última membresía), no el precio de lista del plan. Sin pagos registrados, el precio del plan.
 */
export function renewalPrice(c: RenewalSource): { price: number; planName: string; priceSource: "lastPayment" | "plan"; isTraining: boolean } {
  const ep = c.trainingPlans[0] ?? null
  const lastMembership = c.payments.find((p) => p.income?.category === "MEMBERSHIP" && !(p.concept ?? "").startsWith("Saldo"))
  if (ep && (!lastMembership || ep.createdAt >= lastMembership.paidAt)) {
    const linked = ep.incomeId ? c.payments.find((p) => p.incomeId === ep.incomeId) : undefined
    return { price: linked ? paymentTotal(linked, c.payments) : ep.pricePaid, planName: trainingPlanName(ep), priceSource: "lastPayment", isTraining: true }
  }
  const planName = c.membershipPlan?.name ?? ""
  return lastMembership
    ? { price: paymentTotal(lastMembership, c.payments), planName, priceSource: "lastPayment", isTraining: false }
    : { price: c.membershipPlan?.price ?? 0, planName, priceSource: "plan", isTraining: false }
}

export async function getRenewalProjection(month: string | null) {
  const { monthStart, monthEnd, yearMonth } = parseYearMonth(month)

  const clients = await prisma.client.findMany({
    where: {
      isActive: true,
      membershipEnd: { gte: monthStart, lte: monthEnd },
      // La 2ª persona de una pareja comparte la membresía de la ficha principal: no se cuenta dos veces.
      partnerOfId: null,
      OR: [{ membershipPlan: { isNot: null } }, { trainingPlans: { some: {} } }],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      firstName2: true,
      lastName2: true,
      membershipEnd: true,
      ...RENEWAL_SELECT,
      renewalSkips: { where: { yearMonth }, select: { id: true } },
    },
    orderBy: { membershipEnd: "asc" },
  })

  const result = clients.map((c) => {
    const { price, planName, priceSource } = renewalPrice(c)
    return {
      id: c.id,
      name: [c.firstName, c.lastName, c.firstName2, c.lastName2].filter(Boolean).join(" "),
      membershipEnd: c.membershipEnd,
      planName,
      price,
      priceSource,
      willSkip: c.renewalSkips.length > 0,
    }
  })

  const projectedTotal = result.filter((c) => !c.willSkip).reduce((s, c) => s + c.price, 0)
  const skippedTotal = result.filter((c) => c.willSkip).reduce((s, c) => s + c.price, 0)

  const [y, m] = yearMonth.split("-")
  const monthLabel = format(new Date(Number(y), Number(m) - 1, 1), "MMMM yyyy", { locale: es })

  const balances = await getPendingBalances(monthStart, monthEnd)
  const balancesTotal = Math.round(balances.reduce((s, b) => s + b.amount, 0) * 100) / 100

    return { clients: result as RenewalRow[], projectedTotal, skippedTotal, balances, balancesTotal, monthLabel, yearMonth }
}
