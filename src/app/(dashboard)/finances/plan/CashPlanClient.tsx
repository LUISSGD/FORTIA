"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Btn, Field, Input, Modal, api } from "@/components/coaching/kit"
import { computeCashPlan, salesToCover, type Scenario, type TimelineEvent } from "@/lib/finance/cash-plan"

// Plan del mes: cuánto tengo, qué entra y qué pago primero, con fecha límite. Se recalcula al instante.

type Item = { id: string; expenseId: string; priority: number; payBy: string; concept: string; category: string | null; month: number; year: number; amount: number; currency: string; status: string }
type Sale = { id: string; label: string; membershipPlanId: string | null; unitPrice: number; quantity: number; expectedOn: string | null }
type Candidate = { id: string; concept: string; category: string | null; month: number; year: number; amount: number; currency: string }
type Data = {
  yearMonth: string
  today: string
  monthEnd: string
  plan: { bankPen: number; bankUsd: number; exchangeRate: number; bankUpdatedAt: string | null; notes: string | null; items: Item[]; sales: Sale[] }
  candidates: Candidate[]
  products: { id: string; name: string; price: number }[]
  renewals: { name: string; end: string | null; price: number; willSkip: boolean }[]
}

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"]
const SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"]
const num = (v: number) => v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const soles = (v: number) => `S/ ${num(v)}`
const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`
const shiftMonth = (ym: string, d: number) => {
  const [y, m] = ym.split("-").map(Number)
  const t = new Date(Date.UTC(y, m - 1 + d, 1))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`
}
const ymLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
const origin = (i: { month: number; year: number }) => `${MONTHS[i.month - 1]}${i.year !== Number(new Date().getFullYear()) ? ` ${i.year}` : ""}`

export default function CashPlanClient() {
  const [month, setMonth] = useState("")
  const [data, setData] = useState<Data | null>(null)
  const [bank, setBank] = useState({ pen: "", usd: "", rate: "3.45" })
  const [dirtyBank, setDirtyBank] = useState(false)
  const [view, setView] = useState<Scenario["key"]>("renewals")
  const [adding, setAdding] = useState(false)
  const [saleForm, setSaleForm] = useState<Partial<Sale> | null>(null)
  const [showRenewals, setShowRenewals] = useState(false)

  const load = useCallback(async (ym?: string) => {
    try {
      const d = await api<Data>(`/api/finances/cash-plan${ym ? `?month=${ym}` : ""}`)
      setData(d)
      setMonth(d.yearMonth)
      setBank({ pen: d.plan.bankPen ? String(d.plan.bankPen) : "", usd: d.plan.bankUsd ? String(d.plan.bankUsd) : "", rate: String(d.plan.exchangeRate) })
      setDirtyBank(false)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }, [])
  useEffect(() => { load() }, [load])

  async function post(body: object, ok?: string) {
    try {
      await api("/api/finances/cash-plan", "POST", { month, ...body })
      if (ok) toast.success(ok)
      await load(month)
      return true
    } catch (e) {
      toast.error((e as Error).message)
      return false
    }
  }

  const bankNum = { pen: Number(bank.pen) || 0, usd: Number(bank.usd) || 0, rate: Number(bank.rate) || 3.45 }
  const items = useMemo(() => data?.plan.items ?? [], [data])
  const calc = useMemo(() => {
    if (!data) return null
    return computeCashPlan({
      bank: bankNum,
      payments: items.map((i) => ({ id: i.id, concept: `${i.concept} (${SHORT[i.month - 1]})`, month: i.month, year: i.year, amount: i.amount, currency: i.currency, status: i.status, priority: i.priority, payBy: i.payBy })),
      renewals: data.renewals,
      sales: data.plan.sales,
      today: data.today,
      monthEnd: data.monthEnd,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, items, bank.pen, bank.usd, bank.rate])

  if (!data || !calc) return <main className="flex-1 p-6 text-sm text-gray-500">Cargando…</main>

  const scenario = calc.scenarios.find((s) => s.key === view)!
  const afterById = new Map(scenario.timeline.filter((e): e is Extract<TimelineEvent, { kind: "out" }> => e.kind === "out").map((e) => [e.paymentId, e]))
  const pendingItems = items.filter((i) => i.status !== "PAGADO")
  const paidItems = items.filter((i) => i.status === "PAGADO")
  const planMonth = Number(month.slice(5, 7)), planYear = Number(month.slice(0, 4))
  const isLate = (i: { month: number; year: number }) => i.year < planYear || (i.year === planYear && i.month < planMonth)
  const productsForCover = data.plan.sales.length
    ? data.plan.sales.map((s) => ({ label: s.label, price: s.unitPrice }))
    : data.products.filter((p) => /fortia x|elite|prime/i.test(p.name)).slice(0, 4).map((p) => ({ label: p.name, price: p.price }))
  const withSales = calc.scenarios[2], base = calc.scenarios[1]
  const rate = calc.rate

  async function saveBank() {
    if (await post({ action: "setBank", bankPen: bankNum.pen, bankUsd: bankNum.usd, exchangeRate: bankNum.rate }, "Saldo guardado")) setDirtyBank(false)
  }

  async function move(i: Item, d: -1 | 1) {
    const ids = items.map((x) => x.id)
    const a = ids.indexOf(i.id), b = a + d
    if (b < 0 || b >= ids.length) return
    ;[ids[a], ids[b]] = [ids[b], ids[a]]
    await post({ action: "reorder", ids })
  }

  async function setPaid(i: Item, paid: boolean) {
    try {
      await api("/api/finances/obligations", "POST", { action: "setStatus", year: i.year, month: i.month, concept: i.concept, status: paid ? "PAGADO" : "PENDIENTE" })
      if (paid) {
        const usd = i.currency === "USD"
        const msg = `¿Descontar ${usd ? `US$ ${num(i.amount)}` : soles(i.amount)} de tu saldo del banco?\n(Así el plan no cuenta dos veces ese dinero.)`
        if (confirm(msg)) {
          const pen = usd ? bankNum.pen - Math.max(0, i.amount - bankNum.usd) * bankNum.rate : bankNum.pen - i.amount
          const usdLeft = usd ? Math.max(0, bankNum.usd - i.amount) : bankNum.usd
          await api("/api/finances/cash-plan", "POST", { month, action: "setBank", bankPen: Math.round(pen * 100) / 100, bankUsd: usdLeft, exchangeRate: bankNum.rate })
        }
        toast.success(`${i.concept} pagado ✓`)
      }
      await load(month)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function exportExcel() {
    const { default: ExcelJS } = await import("exceljs")
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(`Plan ${ymLabel(month)}`)
    ws.addRow([`Plan del mes · ${ymLabel(month)}`]).font = { bold: true, size: 14 }
    ws.addRow([])
    ws.addRow(["Caja hoy (S/)", bankNum.pen]); ws.addRow(["Caja hoy (US$)", bankNum.usd]); ws.addRow(["Tipo de cambio", bankNum.rate])
    ws.addRow(["Renovaciones proyectadas", calc!.renewalsTotal]); ws.addRow(["Ventas extra", calc!.salesTotal]); ws.addRow(["Pagos pendientes del plan", calc!.needed])
    ws.addRow([])
    ws.addRow(["Escenario", "Disponible", "A pagar", "Sobra / falta", "Pagos que cubre"]).font = { bold: true }
    calc!.scenarios.forEach((s) => ws.addRow([s.label, s.available, s.needed, s.result, `${s.covered} de ${calc!.pendingCount}`]))
    ws.addRow([])
    ws.addRow(["Prioridad", "Concepto", "Mes", "Moneda", "Monto", "En soles", "Fecha límite", "Estado"]).font = { bold: true }
    items.forEach((i, k) => ws.addRow([k + 1, i.concept, origin(i), i.currency, i.amount, i.currency === "USD" ? Math.round(i.amount * rate * 100) / 100 : i.amount, dm(i.payBy), i.status === "PAGADO" ? "Pagado" : "Pendiente"]))
    ws.addRow([])
    ws.addRow(["Ventas extra", "Precio", "Cantidad", "Subtotal", "Fecha"]).font = { bold: true }
    data!.plan.sales.forEach((s) => ws.addRow([s.label, s.unitPrice, s.quantity, s.unitPrice * s.quantity, s.expectedOn ? dm(s.expectedOn) : "fin de mes"]))
    ws.getColumn(1).width = 34; ws.getColumn(2).width = 30
    for (const c of [2, 3, 4, 5, 6]) ws.getColumn(c).numFmt = "#,##0.00"
    const buf = await wb.xlsx.writeBuffer()
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
    a.download = `Plan del mes ${ymLabel(month)}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // Veredicto principal: con lo seguro (caja + renovaciones) y con las ventas extra
  const verdict = base.result >= 0
    ? { tone: "bg-emerald-50 border-emerald-200 text-emerald-800", text: `Con la caja y las renovaciones te alcanza para todo y te sobran ${soles(base.result)}.` }
    : withSales.result >= 0
      ? { tone: "bg-amber-50 border-amber-200 text-amber-800", text: `Con lo seguro te faltan ${soles(-base.result)}. Si logras las ventas extra, cierras con ${soles(withSales.result)} a favor.` }
      : { tone: "bg-red-50 border-red-200 text-red-800", text: `Aun con las ventas extra te faltan ${soles(-withSales.result)}. Mueve fechas, baja prioridades o suma ventas.` }

  return (
    <main className="flex-1 p-3 md:p-6 space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => load(shiftMonth(month, -1))} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Plan del mes · {ymLabel(month)}</h1>
            <p className="text-xs text-gray-500">Cuánto tienes, qué entra y qué pagas primero. Los números se recalculan al instante.</p>
          </div>
          <button onClick={() => load(shiftMonth(month, 1))} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-2">
          <Link href="/finances/obligaciones"><Btn size="sm" variant="outline">Ver obligaciones</Btn></Link>
          <Btn size="sm" variant="outline" onClick={() => exportExcel().catch(() => toast.error("No se pudo generar el Excel"))}><Download className="h-3.5 w-3.5" /> Excel</Btn>
        </div>
      </div>

      {calc.pendingCount > 0 && <div className={cn("rounded-xl border px-4 py-3 text-sm font-medium", verdict.tone)}>{verdict.text}</div>}

      {/* Escenarios */}
      <div className="grid md:grid-cols-3 gap-3">
        {calc.scenarios.map((s) => (
          <button key={s.key} onClick={() => setView(s.key)} className={cn("text-left rounded-xl border bg-white p-4 space-y-1 transition", view === s.key ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200 hover:border-gray-300")}>
            <p className="text-xs font-semibold text-gray-500">{s.label}</p>
            <p className={cn("text-2xl font-bold tabular-nums", s.result >= 0 ? "text-emerald-600" : "text-red-600")}>{s.result >= 0 ? "+" : "−"} {soles(Math.abs(s.result))}</p>
            <p className="text-xs text-gray-500">Tienes {soles(s.available)} · Pagas {soles(s.needed)}</p>
            <p className="text-xs text-gray-700">Cubre <b>{s.covered} de {calc.pendingCount}</b> pagos en orden</p>
            {s.firstShort && <p className="text-xs text-red-600">⚠️ El {dm(s.firstShort.date)} no alcanza para {s.firstShort.label}: faltan {soles(s.firstShort.missing)}</p>}
            {!s.firstShort && s.lowest.balance < 0 && <p className="text-xs text-amber-700">Saldo más bajo: {soles(s.lowest.balance)} el {dm(s.lowest.date)}</p>}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4 items-start">
        <div className="space-y-4">
          {/* Caja hoy */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">🏦 Caja hoy (banco)</h2>
              {data.plan.bankUpdatedAt && <span className="text-[11px] text-gray-400">actualizado {new Date(data.plan.bankUpdatedAt).toLocaleDateString("es-PE")}</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Soles (S/)"><Input type="number" inputMode="decimal" step="0.01" value={bank.pen} onChange={(e) => { setBank((b) => ({ ...b, pen: e.target.value })); setDirtyBank(true) }} placeholder="0.00" /></Field>
              <Field label="Dólares (US$)"><Input type="number" inputMode="decimal" step="0.01" value={bank.usd} onChange={(e) => { setBank((b) => ({ ...b, usd: e.target.value })); setDirtyBank(true) }} placeholder="0.00" /></Field>
              <Field label="Tipo de cambio"><Input type="number" inputMode="decimal" step="0.01" value={bank.rate} onChange={(e) => { setBank((b) => ({ ...b, rate: e.target.value })); setDirtyBank(true) }} /></Field>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm">Total en soles: <b className="tabular-nums">{soles(calc.cashPen)}</b></p>
              <Btn size="sm" disabled={!dirtyBank} onClick={saveBank}>{dirtyBank ? "Guardar saldo" : "Guardado"}</Btn>
            </div>
            {calc.usd.needed > 0 && (
              <p className={cn("rounded-lg px-3 py-2 text-xs", calc.usd.missing > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800")}>
                💵 Pagos en dólares: necesitas <b>US$ {num(calc.usd.needed)}</b> y tienes US$ {num(calc.usd.have)}.
                {calc.usd.missing > 0 ? <> Te faltan <b>US$ {num(calc.usd.missing)}</b> (≈ {soles(calc.usd.missing * rate)} a T.C. {rate}).</> : " Te alcanzan."}
              </p>
            )}
          </section>

          {/* Lo que entra */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">📈 Lo que entra este mes</h2>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center justify-between text-sm">
                <button onClick={() => setShowRenewals((v) => !v)} className="font-medium text-gray-800 hover:text-orange-600">
                  Renovaciones · {data.renewals.filter((r) => !r.willSkip).length} clientes {showRenewals ? "▲" : "▼"}
                </button>
                <b className="tabular-nums text-emerald-700">{soles(calc.renewalsTotal)}</b>
              </div>
              {showRenewals && (
                <ul className="mt-2 space-y-0.5 text-xs">
                  {data.renewals.map((r, k) => (
                    <li key={k} className={cn("flex justify-between", r.willSkip && "line-through text-gray-400")}>
                      <span>{r.end ? dm(r.end) : "—"} · {r.name}{r.end && r.end < data.today && !r.willSkip ? " (vencido, por cobrar)" : ""}</span>
                      <span className="tabular-nums">{soles(r.price)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/finances/proyeccion" className="mt-1 block text-[11px] text-orange-600">Marcar quién no renueva →</Link>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800">Ventas extra (proyección)</p>
                <Btn size="sm" variant="outline" onClick={() => setSaleForm({ quantity: 1 })}><Plus className="h-3.5 w-3.5" /> Venta</Btn>
              </div>
              {data.plan.sales.length === 0 ? (
                <p className="text-xs text-gray-400">Ej.: 4 Fortia X, 1 Elite Athlete… Suma lo que esperas vender este mes.</p>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {data.plan.sales.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 py-1.5">
                      <button onClick={() => setSaleForm(s)} className="flex-1 min-w-0 text-left hover:text-orange-600">
                        <span className="font-semibold">{s.quantity} ×</span> {s.label}
                        <span className="block text-[11px] text-gray-400">{soles(s.unitPrice)} c/u · {s.expectedOn ? `cobro ${dm(s.expectedOn)}` : "cobro fin de mes"}</span>
                      </button>
                      <b className="tabular-nums">{soles(s.unitPrice * s.quantity)}</b>
                      <button onClick={() => post({ action: "removeSale", id: s.id })} className="p-1 text-gray-300 hover:text-red-500" aria-label="Quitar"><Trash2 className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                  <li className="flex justify-between py-1.5 font-semibold"><span>Total ventas extra</span><span className="tabular-nums text-emerald-700">{soles(calc.salesTotal)}</span></li>
                </ul>
              )}
            </div>

            {base.result < 0 && productsForCover.length > 0 && (
              <div className="rounded-lg bg-orange-50 p-3 text-xs text-orange-900 space-y-1">
                <p className="font-semibold">Para cubrir los {soles(-base.result)} que faltan necesitas vender, por ejemplo:</p>
                {salesToCover(-base.result, productsForCover).slice(0, 4).map((x) => (
                  <p key={x.label}>• <b>{x.units}</b> × {x.label} ({soles(x.price)})</p>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Pagos priorizados */}
        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between gap-2 p-4 pb-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">📋 Pagos del mes, en orden de prioridad</h2>
              <p className="text-[11px] text-gray-400">"Saldo después" según: <b>{scenario.label.toLowerCase()}</b> (cámbialo arriba)</p>
            </div>
            <Btn size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Agregar obligación</Btn>
          </div>
          {items.length === 0 ? (
            <p className="px-4 pb-6 pt-2 text-sm text-gray-500">Agrega lo que quieres pagar este mes: por ejemplo el mantenimiento de julio, el alquiler de setiembre, la SUNAT…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                  <tr>
                    <th className="px-2 py-2 text-left w-8">#</th>
                    <th className="px-2 py-2 text-left">Concepto</th>
                    <th className="px-2 py-2 text-right">Monto</th>
                    <th className="px-2 py-2 text-left">Pagar hasta</th>
                    <th className="px-2 py-2 text-right whitespace-nowrap">Saldo después</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingItems.map((i, k) => {
                    const ev = afterById.get(i.id)
                    const short = !!ev && ev.short > 0
                    return (
                      <tr key={i.id} className={cn(short && "bg-red-50/60")}>
                        <td className="px-2 py-2 text-xs font-bold text-gray-400">{k + 1}</td>
                        <td className="px-2 py-2">
                          <p className="font-medium text-gray-900">{i.concept}</p>
                          <p className={cn("text-[11px]", isLate(i) ? "text-red-600" : "text-gray-400")}>{origin(i)}{isLate(i) ? " · atrasado" : ""}{i.category ? ` · ${i.category}` : ""}</p>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                          {i.currency === "USD" ? <>US$ {num(i.amount)}<span className="block text-[10px] text-gray-400">≈ {soles(i.amount * rate)}</span></> : soles(i.amount)}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="date"
                            value={i.payBy}
                            onChange={(e) => e.target.value && post({ action: "updateItem", id: i.id, payBy: e.target.value })}
                            className={cn("rounded border px-1.5 py-1 text-xs", i.payBy < data.today ? "border-red-300 text-red-600" : "border-gray-200")}
                          />
                        </td>
                        <td className={cn("px-2 py-2 text-right tabular-nums whitespace-nowrap font-semibold", ev && ev.balance < 0 ? "text-red-600" : "text-gray-800")}>
                          {ev ? soles(ev.balance) : "—"}
                          {short && <span className="block text-[10px] font-normal">faltan {soles(ev!.short)}</span>}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => move(i, -1)} className="p-1 text-gray-400 hover:text-gray-800" aria-label="Subir prioridad"><ArrowUp className="h-3.5 w-3.5" /></button>
                            <button onClick={() => move(i, 1)} className="p-1 text-gray-400 hover:text-gray-800" aria-label="Bajar prioridad"><ArrowDown className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setPaid(i, true)} className="ml-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100">✓ Pagado</button>
                            <button onClick={() => post({ action: "removeItem", id: i.id })} className="p-1 text-gray-300 hover:text-red-500" aria-label="Quitar del plan"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td />
                    <td className="px-2 py-2">Total por pagar</td>
                    <td className="px-2 py-2 text-right tabular-nums">{soles(calc.needed)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {paidItems.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-emerald-700">✓ Ya pagado este mes · {soles(calc.paidTotal)}</p>
              {paidItems.map((i) => (
                <div key={i.id} className="flex items-center justify-between text-xs text-gray-500">
                  <span>{i.concept} · {origin(i)}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{i.currency === "USD" ? `US$ ${num(i.amount)}` : soles(i.amount)}</span>
                    <button onClick={() => setPaid(i, false)} className="text-gray-400 underline">deshacer</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Línea de tiempo */}
      {scenario.timeline.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">🗓️ Día a día · {scenario.label.toLowerCase()}</h2>
            <div className="flex gap-1">
              {calc.scenarios.map((s) => (
                <button key={s.key} onClick={() => setView(s.key)} className={cn("rounded-full px-2.5 py-1 text-[11px]", view === s.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600")}>{s.key === "cash" ? "Solo caja" : s.key === "renewals" ? "+ Renovaciones" : "+ Ventas extra"}</button>
              ))}
            </div>
          </div>
          <ul className="divide-y divide-gray-100 text-sm">
            <li className="flex justify-between py-1.5 text-gray-500"><span>Hoy · caja inicial</span><span className="tabular-nums">{soles(calc.cashPen)}</span></li>
            {scenario.timeline.map((e, k) => (
              <li key={k} className={cn("grid grid-cols-[3rem_1fr_auto_auto] gap-2 py-1.5 items-center", e.kind === "out" && e.short > 0 && "bg-red-50/60")}>
                <span className="text-xs text-gray-400">{dm(e.date)}</span>
                <span className="truncate">{e.kind === "in" ? "➕ " : "➖ "}{e.label}</span>
                <span className={cn("tabular-nums text-xs", e.kind === "in" ? "text-emerald-700" : "text-gray-700")}>{e.kind === "in" ? "+" : "−"}{num(e.pen)}</span>
                <span className={cn("tabular-nums font-semibold w-28 text-right", e.balance < 0 ? "text-red-600" : "text-gray-900")}>{soles(e.balance)}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-gray-400">Los ingresos de un día entran antes que los pagos de ese día. Las fechas ya pasadas cuentan como hoy.</p>
        </section>
      )}

      {adding && <AddItemsModal data={data} onClose={() => setAdding(false)} onAdd={(ids, payBy) => post({ action: "addItems", expenseIds: ids, payBy }, `${ids.length} obligación(es) agregadas`).then((ok) => ok && setAdding(false))} />}
      {saleForm && (
        <SaleModal
          sale={saleForm}
          products={data.products}
          monthEnd={data.monthEnd}
          onClose={() => setSaleForm(null)}
          onSave={(s) => post({ action: s.id ? "updateSale" : "addSale", ...s }, "Venta guardada").then((ok) => ok && setSaleForm(null))}
        />
      )}
    </main>
  )
}

/** Elegir obligaciones pendientes: por concepto (con atajo "el más atrasado") o un grupo completo de un mes (SUNAT). */
function AddItemsModal({ data, onClose, onAdd }: { data: Data; onClose: () => void; onAdd: (ids: string[], payBy: string) => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [payBy, setPayBy] = useState(data.monthEnd)
  const toggle = (ids: string[], on?: boolean) => setSel((s) => {
    const n = new Set(s)
    const add = on ?? !ids.every((id) => n.has(id))
    ids.forEach((id) => (add ? n.add(id) : n.delete(id)))
    return n
  })

  const groups = new Map<string, Candidate[]>()
  const concepts = new Map<string, Candidate[]>()
  for (const c of data.candidates) {
    if (c.category) groups.set(c.category, [...(groups.get(c.category) ?? []), c])
    else concepts.set(c.concept, [...(concepts.get(c.concept) ?? []), c])
  }
  const chosen = data.candidates.filter((c) => sel.has(c.id))
  const rate = data.plan.exchangeRate || 3.45
  const total = chosen.reduce((s, c) => s + (c.currency === "USD" ? c.amount * rate : c.amount), 0)
  const money = (c: Candidate) => (c.currency === "USD" ? `US$ ${num(c.amount)}` : num(c.amount))
  const chip = (c: Candidate, label: string) => (
    <button key={c.id} onClick={() => toggle([c.id])} className={cn("rounded-full border px-2 py-0.5 text-[11px]", sel.has(c.id) ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600 hover:border-gray-400")}>
      {label} · {money(c)}
    </button>
  )

  return (
    <Modal open onClose={onClose} title="Agregar obligaciones al plan" wide>
      <div className="space-y-4">
        {data.candidates.length === 0 && <p className="text-sm text-gray-500">No hay obligaciones pendientes hasta este mes.</p>}

        {[...groups.entries()].map(([g, list]) => {
          const months = [...new Map(list.map((c) => [`${c.year}-${c.month}`, c])).values()]
          return (
            <div key={g} className="rounded-lg border border-orange-200 bg-orange-50/50 p-3 space-y-1.5">
              <p className="text-sm font-semibold text-orange-900">Total {g} <span className="font-normal text-orange-700/70">· elige el mes (agrega todos sus conceptos)</span></p>
              <div className="flex flex-wrap gap-1.5">
                {months.map((mc) => {
                  const ids = list.filter((c) => c.month === mc.month && c.year === mc.year).map((c) => c.id)
                  const on = ids.every((id) => sel.has(id))
                  const sum = list.filter((c) => ids.includes(c.id)).reduce((s, c) => s + c.amount, 0)
                  return (
                    <button key={`${mc.year}-${mc.month}`} onClick={() => toggle(ids)} className={cn("rounded-full border px-2 py-0.5 text-[11px]", on ? "border-gray-900 bg-gray-900 text-white" : "border-orange-200 bg-white text-orange-900")}>
                      {MONTHS[mc.month - 1]} · {num(sum)} ({ids.length})
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="divide-y divide-gray-100">
          {[...concepts.entries()].map(([concept, list]) => (
            <div key={concept} className="py-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{concept}</p>
                <div className="flex gap-2 text-[11px]">
                  <button onClick={() => toggle([list[0].id], true)} className="text-orange-600 hover:underline">el más atrasado</button>
                  <button onClick={() => toggle(list.map((c) => c.id))} className="text-gray-500 hover:underline">todos</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">{list.map((c) => chip(c, `${MONTHS[c.month - 1]}${c.year !== Number(data.yearMonth.slice(0, 4)) ? ` ${c.year}` : ""}`))}</div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-end justify-between gap-3 border-t border-gray-100 bg-white px-4 py-3">
          <div className="text-sm">
            <p><b>{chosen.length}</b> elegidas · <b className="tabular-nums">S/ {num(total)}</b></p>
            <label className="mt-1 flex items-center gap-2 text-xs text-gray-600">
              Pagar hasta
              <input type="date" value={payBy} onChange={(e) => setPayBy(e.target.value)} className="rounded border border-gray-200 px-1.5 py-1" />
            </label>
          </div>
          <div className="flex gap-2">
            <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
            <Btn disabled={!chosen.length} onClick={() => onAdd(chosen.map((c) => c.id), payBy)}>Agregar al plan</Btn>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function SaleModal({ sale, products, monthEnd, onClose, onSave }: { sale: Partial<Sale>; products: Data["products"]; monthEnd: string; onClose: () => void; onSave: (s: Partial<Sale>) => void }) {
  const [form, setForm] = useState<Partial<Sale>>({ expectedOn: null, ...sale })
  const pick = (id: string) => {
    const p = products.find((x) => x.id === id)
    setForm((f) => ({ ...f, membershipPlanId: id || null, label: p?.name ?? f.label, unitPrice: p?.price ?? f.unitPrice }))
  }
  return (
    <Modal open onClose={onClose} title={sale.id ? "Editar venta extra" : "Nueva venta extra"}>
      <div className="space-y-3">
        <Field label="Plan (trae su precio)">
          <select value={form.membershipPlanId ?? ""} onChange={(e) => pick(e.target.value)} className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm">
            <option value="">Otro (escribir abajo)</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} · S/ {num(p.price)}</option>)}
          </select>
        </Field>
        <Field label="Descripción"><Input value={form.label ?? ""} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Ej. Fortia X mensual" /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Precio (S/)"><Input type="number" inputMode="decimal" step="0.01" value={form.unitPrice ?? ""} onChange={(e) => setForm((f) => ({ ...f, unitPrice: Number(e.target.value) }))} /></Field>
          <Field label="Cantidad"><Input type="number" inputMode="numeric" min={0} value={form.quantity ?? 1} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))} /></Field>
          <Field label="Cobro estimado"><Input type="date" value={form.expectedOn ?? monthEnd} onChange={(e) => setForm((f) => ({ ...f, expectedOn: e.target.value || null }))} /></Field>
        </div>
        <p className="text-sm">Subtotal: <b>S/ {num((form.unitPrice ?? 0) * (form.quantity ?? 0))}</b></p>
        <div className="flex justify-end gap-2">
          <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
          <Btn disabled={!form.label?.trim() || !(form.unitPrice && form.unitPrice > 0)} onClick={() => onSave(form)}>Guardar</Btn>
        </div>
      </div>
    </Modal>
  )
}
