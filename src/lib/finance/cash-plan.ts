// Cálculo del Plan del mes (función pura, sin base de datos): caja de hoy + lo que entra − pagos priorizados.
//
// Reglas:
// - Todo se compara en soles. Los pagos en US$ salen primero del saldo en dólares; si no alcanza,
//   lo que falta se compra con soles al tipo de cambio del plan.
// - Línea de tiempo: cada ingreso entra en su fecha y cada pago sale en su fecha límite (las fechas
//   pasadas cuentan como hoy). El mismo día entran primero los ingresos y luego salen los pagos por prioridad.
// - Solo cuentan los pagos pendientes; los ya pagados se muestran aparte (ya salieron de la caja).

export type PlanBank = { pen: number; usd: number; rate: number }
export type PlanPayment = { id: string; concept: string; month: number; year: number; amount: number; currency: string; status: string; priority: number; payBy: string }
export type PlanRenewal = { name: string; end: string | null; price: number; willSkip: boolean }
export type PlanSale = { id: string; label: string; unitPrice: number; quantity: number; expectedOn: string | null }

export type TimelineEvent =
  | { kind: "in"; date: string; label: string; source: "renewal" | "sale"; pen: number; balance: number }
  | { kind: "out"; date: string; label: string; paymentId: string; pen: number; usdUsed: number; balance: number; short: number }

export type Scenario = {
  key: "cash" | "renewals" | "sales"
  label: string
  available: number
  needed: number
  /** Sobrante (+) o faltante (−) a fin de mes */
  result: number
  /** Pagos que se pueden hacer completos en el orden del plan */
  covered: number
  timeline: TimelineEvent[]
  /** Primer pago que no alcanza a pagarse en su fecha */
  firstShort: { paymentId: string; label: string; date: string; missing: number } | null
  /** Saldo más bajo durante el mes (para ver huecos de caja aunque a fin de mes cuadre) */
  lowest: { date: string; balance: number }
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function computeCashPlan(input: {
  bank: PlanBank
  payments: PlanPayment[]
  renewals: PlanRenewal[]
  sales: PlanSale[]
  today: string
  monthEnd: string
}) {
  const { bank, today, monthEnd } = input
  const rate = bank.rate > 0 ? bank.rate : 3.45
  const pending = input.payments.filter((p) => p.status !== "PAGADO").sort((a, b) => a.priority - b.priority)
  const paid = input.payments.filter((p) => p.status === "PAGADO")
  const penOf = (p: { amount: number; currency: string }) => r2(p.currency === "USD" ? p.amount * rate : p.amount)
  const clamp = (d: string | null, fallback: string) => {
    const x = d ?? fallback
    return x < today ? today : x
  }

  const renewals = input.renewals.filter((r) => !r.willSkip && r.price > 0)
  const sales = input.sales.filter((s) => s.quantity > 0 && s.unitPrice > 0)
  const renewalsTotal = r2(renewals.reduce((s, r) => s + r.price, 0))
  const salesTotal = r2(sales.reduce((s, x) => s + x.unitPrice * x.quantity, 0))
  const cashPen = r2(bank.pen + bank.usd * rate)
  const needed = r2(pending.reduce((s, p) => s + penOf(p), 0))
  const usdNeeded = r2(pending.filter((p) => p.currency === "USD").reduce((s, p) => s + p.amount, 0))

  function simulate(key: Scenario["key"], label: string, withRenewals: boolean, withSales: boolean): Scenario {
    type Ev = { date: string; order: number; run: () => TimelineEvent }
    let pen = bank.pen
    let usd = bank.usd
    const balance = () => r2(pen + usd * rate)
    const evs: Ev[] = []
    if (withRenewals) for (const r of renewals) {
      const date = clamp(r.end, monthEnd)
      evs.push({ date, order: 0, run: () => { pen += r.price; return { kind: "in", date, label: `Renovación ${r.name}`, source: "renewal", pen: r.price, balance: balance() } } })
    }
    if (withSales) for (const s of sales) {
      const date = clamp(s.expectedOn, monthEnd)
      const total = r2(s.unitPrice * s.quantity)
      evs.push({ date, order: 0, run: () => { pen += total; return { kind: "in", date, label: `${s.quantity} × ${s.label}`, source: "sale", pen: total, balance: balance() } } })
    }
    for (const p of pending) {
      const date = clamp(p.payBy, monthEnd)
      evs.push({
        date, order: 1 + p.priority,
        run: () => {
          const before = balance()
          let usdUsed = 0
          if (p.currency === "USD") {
            usdUsed = Math.min(Math.max(usd, 0), p.amount)
            usd -= usdUsed
            pen -= (p.amount - usdUsed) * rate
          } else pen -= p.amount
          const cost = penOf(p)
          return { kind: "out", date, label: p.concept, paymentId: p.id, pen: cost, usdUsed: r2(usdUsed), balance: balance(), short: r2(Math.max(0, cost - Math.max(before, 0))) }
        },
      })
    }
    evs.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
    const timeline = evs.map((e) => e.run())
    const outs = timeline.filter((e): e is Extract<TimelineEvent, { kind: "out" }> => e.kind === "out")
    const first = outs.find((e) => e.short > 0) ?? null
    const lowest = timeline.reduce((m, e) => (e.balance < m.balance ? { date: e.date, balance: e.balance } : m), { date: today, balance: cashPen })
    const available = r2(cashPen + (withRenewals ? renewalsTotal : 0) + (withSales ? salesTotal : 0))
    return {
      key, label, available, needed, result: r2(available - needed),
      covered: first ? outs.indexOf(first) : outs.length,
      timeline,
      firstShort: first ? { paymentId: first.paymentId, label: first.label, date: first.date, missing: first.short } : null,
      lowest,
    }
  }

  const scenarios = [
    simulate("cash", "Solo con la caja de hoy", false, false),
    simulate("renewals", "Caja + renovaciones", true, false),
    simulate("sales", "Caja + renovaciones + ventas extra", true, true),
  ]

  return {
    rate,
    cashPen,
    renewalsTotal,
    salesTotal,
    needed,
    paidTotal: r2(paid.reduce((s, p) => s + penOf(p), 0)),
    pendingCount: pending.length,
    usd: { needed: usdNeeded, have: bank.usd, missing: r2(Math.max(0, usdNeeded - bank.usd)) },
    scenarios,
  }
}

/** Cuántas unidades de cada producto harían falta para cubrir un faltante. */
export function salesToCover(missing: number, products: { label: string; price: number }[]) {
  if (missing <= 0) return []
  return products
    .filter((p) => p.price > 0)
    .map((p) => ({ label: p.label, price: p.price, units: Math.ceil(missing / p.price) }))
    .sort((a, b) => a.units - b.units || b.price - a.price)
}
