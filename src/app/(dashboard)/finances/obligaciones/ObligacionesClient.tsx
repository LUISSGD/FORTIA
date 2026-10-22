"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Download, Plus, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { Btn, Field, Input, Modal, Textarea, api } from "@/components/coaching/kit"

// Flujo de obligaciones: cuadro anual tipo Excel (concepto × mes) con estado pagado/pendiente por celda.

type Item = { id: string; concept: string; amount: number; currency: string; exchangeRate: number | null; month: number; year: number; status: string; paidAt: string | null; notes: string | null; category: string | null; sortOrder: number | null; createdAt: string }
type Row = { key: string; concept: string; category: string | null; order: number; cells: Record<number, Item> }
type Block = { kind: "row"; row: Row } | { kind: "group"; name: string; rows: Row[] }

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"]
const SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"]
const MONTH_ALIASES: Record<string, number> = Object.fromEntries(
  MONTHS.flatMap((m, i) => [[m.toLowerCase(), i + 1], [SHORT[i].toLowerCase(), i + 1]]).concat([["septiembre", 9], ["sep", 9], ["sept", 9]]),
)
const STORE = "fortia.obligaciones"

const num = (v: number) => v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100
const key = (s: string) => s.trim().toLowerCase()
/** Monto en soles (los USD se pasan con su tipo de cambio). */
const pen = (it: Item | undefined) => (!it ? 0 : it.currency === "USD" ? Math.round(it.amount * (it.exchangeRate ?? 3.45) * 100) / 100 : it.amount)
const shown = (it: Item) => (it.currency === "USD" ? `$ ${num(it.amount)}` : num(it.amount))

function buildRows(items: Item[]): Row[] {
  const map = new Map<string, Row>()
  for (const it of items) {
    const k = key(it.concept)
    const r = map.get(k) ?? { key: k, concept: it.concept, category: null, order: Number.MAX_SAFE_INTEGER, cells: {} }
    r.cells[it.month] = it
    if (it.category) r.category = it.category
    r.order = Math.min(r.order, it.sortOrder ?? 100000 + new Date(it.createdAt).getTime() / 1e10)
    map.set(k, r)
  }
  return [...map.values()].sort((a, b) => a.order - b.order || a.concept.localeCompare(b.concept))
}

function buildBlocks(rows: Row[]): Block[] {
  const blocks: Block[] = []
  for (const r of rows) {
    if (!r.category) { blocks.push({ kind: "row", row: r }); continue }
    const g = blocks.find((b): b is Extract<Block, { kind: "group" }> => b.kind === "group" && key(b.name) === key(r.category!))
    if (g) g.rows.push(r)
    else blocks.push({ kind: "group", name: r.category, rows: [r] })
  }
  return blocks
}

/** Lee el cuadro de Excel: fila de meses como encabezado, conceptos a la izquierda, "Total X" = grupo con subtotal. */
export async function parseExcel(file: File) {
  const { default: ExcelJS } = await import("exceljs")
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  const value = (c: unknown): unknown => (c && typeof c === "object" && "result" in (c as object) ? (c as { result: unknown }).result : c)
  let header = 0
  const monthCols = new Map<number, number>()
  ws.eachRow((row, i) => {
    if (header) return
    const found = new Map<number, number>()
    row.eachCell((cell, col) => {
      const m = MONTH_ALIASES[String(value(cell.value) ?? "").trim().toLowerCase()]
      if (m) found.set(col, m)
    })
    if (found.size >= 2) { header = i; found.forEach((m, c) => monthCols.set(c, m)) }
  })
  if (!header) throw new Error("No encontré la fila con los meses (Enero, Febrero…)")
  const firstMonthCol = Math.min(...monthCols.keys())

  // Filas en dólares: el total del Excel las multiplica por el tipo de cambio (p. ej. "+C6*3.45")
  const usdRows = new Map<number, number>()
  ws.eachRow((row, i) => {
    if (i >= header) return
    row.eachCell((cell) => {
      const f = (cell.value as { formula?: string } | null)?.formula
      if (f) for (const m of f.matchAll(/[A-Z]{1,3}(\d+)\s*\*\s*(\d+(?:\.\d+)?)/g)) usdRows.set(Number(m[1]), Number(m[2]))
    })
  })

  const raw: { concept: string; amounts: Record<number, number>; currency: string; exchangeRate: number | null }[] = []
  ws.eachRow((row, i) => {
    if (i <= header) return
    let concept = ""
    for (let c = 1; c < firstMonthCol; c++) {
      const v = value(row.getCell(c).value)
      if (typeof v === "string" && v.trim()) concept = v.trim().replace(/\s+/g, " ")
    }
    if (!concept) return
    const amounts: Record<number, number> = {}
    monthCols.forEach((m, c) => {
      const v = Number(value(row.getCell(c).value))
      if (Number.isFinite(v)) amounts[m] = Math.round(v * 100) / 100
    })
    raw.push({ concept, amounts, currency: usdRows.has(i) ? "USD" : "PEN", exchangeRate: usdRows.get(i) ?? null })
  })

  // "Total SUNAT" → grupo SUNAT con las filas siguientes cuya suma coincide con ese total
  const rows: { concept: string; category: string | null; amounts: Record<number, number>; currency: string; exchangeRate: number | null }[] = []
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]
    const total = /^total\s+(.+)$/i.exec(r.concept)
    if (!total) { rows.push({ ...r, category: null }); continue }
    const months = Object.keys(r.amounts).map(Number)
    let size = 0, acc: Record<number, number> = {}
    for (let k = i + 1; k < raw.length; k++) {
      months.forEach((m) => (acc[m] = (acc[m] ?? 0) + (raw[k].amounts[m] ?? 0)))
      if (months.every((m) => Math.abs((acc[m] ?? 0) - (r.amounts[m] ?? 0)) < 0.5) && months.some((m) => r.amounts[m])) { size = k - i; break }
    }
    if (!size) { acc = {}; continue } // un total que no cuadra: se ignora (se calcula solo)
    for (let k = i + 1; k <= i + size; k++) rows.push({ ...raw[k], category: total[1].trim() })
    i += size
  }
  const yearInName = /20\d\d/.exec(ws.name)?.[0]
  return { rows, year: yearInName ? Number(yearInName) : null, months: [...new Set(monthCols.values())].sort((a, b) => a - b) }
}

export default function ObligacionesClient() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [hideEmpty, setHideEmpty] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [cell, setCell] = useState<{ row: Row | null; month: number } | null>(null)
  const [rowEdit, setRowEdit] = useState<Row | null>(null)
  const [adding, setAdding] = useState(false)
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof parseExcel>> | null>(null)
  const [replaceAll, setReplaceAll] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(STORE) ?? "null"); if (s) { setHideEmpty(s.hideEmpty ?? true); setCollapsed(new Set(s.collapsed ?? [])) } } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ hideEmpty, collapsed: [...collapsed] })) } catch {}
  }, [hideEmpty, collapsed])

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems((await api<{ items: Item[] }>(`/api/finances/obligations?year=${year}`)).items) }
    catch (e) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }, [year])
  useEffect(() => { load() }, [load])

  const rows = useMemo(() => buildRows(items), [items])
  const blocks = useMemo(() => buildBlocks(rows), [rows])
  const categories = useMemo(() => [...new Set(rows.map((r) => r.category).filter(Boolean))] as string[], [rows])
  const curMonth = year === today.getFullYear() ? today.getMonth() + 1 : year < today.getFullYear() ? 13 : 0
  const months = useMemo(() => {
    const all = Array.from({ length: 12 }, (_, i) => i + 1)
    if (!hideEmpty) return all
    const used = new Set(items.filter((i) => i.amount > 0).map((i) => i.month))
    if (curMonth >= 1 && curMonth <= 12) used.add(curMonth)
    const list = all.filter((m) => used.has(m))
    return list.length ? list : all
  }, [items, hideEmpty, curMonth])

  const amt = (r: Row, m: number) => pen(r.cells[m])
  const monthTotal = (m: number) => sum(rows.map((r) => amt(r, m)))
  const monthPaid = (m: number) => sum(rows.map((r) => (r.cells[m]?.status === "PAGADO" ? amt(r, m) : 0)))
  const yearTotal = sum(Array.from({ length: 12 }, (_, i) => monthTotal(i + 1)))
  const yearPaid = sum(Array.from({ length: 12 }, (_, i) => monthPaid(i + 1)))
  const overdue = sum(rows.flatMap((r) => Object.values(r.cells).filter((c) => c.status !== "PAGADO" && c.month < curMonth).map((c) => pen(c))))
  const thisMonthPending = curMonth >= 1 && curMonth <= 12 ? sum([monthTotal(curMonth) - monthPaid(curMonth)]) : 0

  async function post(body: object, ok?: string) {
    try {
      await api("/api/finances/obligations", "POST", { year, ...body })
      if (ok) toast.success(ok)
      await load()
      return true
    } catch (e) {
      toast.error((e as Error).message)
      return false
    }
  }

  async function move(r: Row, dir: -1 | 1) {
    const list = rows.map((x) => x.concept)
    const i = rows.indexOf(r), j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    await post({ action: "reorder", concepts: list })
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    try { setPreview(await parseExcel(f)) } catch (err) { toast.error((err as Error).message || "No se pudo leer el Excel") }
  }

  async function exportExcel() {
    const { default: ExcelJS } = await import("exceljs")
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(`Obligaciones ${year}`)
    const all = Array.from({ length: 12 }, (_, i) => i + 1)
    ws.addRow(["Concepto", ...all.map((m) => MONTHS[m - 1]), "Total"]).font = { bold: true }
    const line = (label: string, vals: number[], bold = false) => {
      const r = ws.addRow([label, ...vals, sum(vals)])
      if (bold) r.font = { bold: true }
    }
    for (const b of blocks) {
      if (b.kind === "row") line(b.row.concept, all.map((m) => amt(b.row, m)))
      else {
        line(`Total ${b.name}`, all.map((m) => sum(b.rows.map((r) => amt(r, m)))), true)
        b.rows.forEach((r) => line(`   ${r.concept}`, all.map((m) => amt(r, m))))
      }
    }
    line("TOTAL DEL MES", all.map(monthTotal), true)
    line("Pagado", all.map(monthPaid))
    line("Pendiente", all.map((m) => sum([monthTotal(m) - monthPaid(m)])))
    ws.getColumn(1).width = 34
    all.forEach((_, i) => { ws.getColumn(i + 2).width = 12; ws.getColumn(i + 2).numFmt = "#,##0.00" })
    ws.getColumn(14).width = 13; ws.getColumn(14).numFmt = "#,##0.00"
    const buf = await wb.xlsx.writeBuffer()
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
    a.download = `Obligaciones ${year}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const cellClass = (it: Item | undefined, m: number) => {
    if (!it || !it.amount) return "text-gray-300"
    if (it.status === "PAGADO") return "bg-emerald-50 text-emerald-700"
    if (m < curMonth) return "bg-red-50 text-red-700 font-semibold"
    if (m === curMonth) return "bg-amber-50 text-amber-800"
    return "text-gray-800"
  }

  const renderRow = (r: Row, indent = false) => (
    <tr key={r.key} className="border-b border-gray-100 hover:bg-gray-50/60">
      <td className="sticky left-0 z-10 bg-white px-2 py-1.5 min-w-[190px] max-w-[240px]">
        <button onClick={() => setRowEdit(r)} className={cn("text-left text-sm text-gray-800 hover:text-orange-600 truncate w-full", indent && "pl-4 text-gray-600")} title="Editar fila">
          {r.concept}
        </button>
      </td>
      {months.map((m) => {
        const it = r.cells[m]
        return (
          <td key={m} className="p-0 border-l border-gray-100">
            <button onClick={() => setCell({ row: r, month: m })} className={cn("w-full h-full px-2 py-1.5 text-right text-sm tabular-nums whitespace-nowrap hover:ring-2 hover:ring-inset hover:ring-orange-300", cellClass(it, m))} title={[it?.currency === "USD" ? `≈ S/ ${num(pen(it))} (T.C. ${it.exchangeRate ?? 3.45})` : "", it?.notes ?? ""].filter(Boolean).join(" · ") || undefined}>
              {it && it.amount ? <>{it.status === "PAGADO" && <span className="mr-1 text-[10px]">✓</span>}{shown(it)}{it.notes && <span className="ml-0.5 text-[9px] align-top">•</span>}</> : "—"}
            </button>
          </td>
        )
      })}
      <td className="px-2 py-1.5 text-right text-sm font-semibold tabular-nums whitespace-nowrap border-l border-gray-200 bg-gray-50">{num(sum(Object.values(r.cells).map((c) => pen(c))))}</td>
    </tr>
  )

  const totalLine = (label: string, vals: (m: number) => number, cls: string) => (
    <tr className={cls}>
      <td className="sticky left-0 z-10 bg-inherit px-2 py-2 text-sm font-bold">{label}</td>
      {months.map((m) => <td key={m} className="px-2 py-2 text-right text-sm font-bold tabular-nums whitespace-nowrap border-l border-gray-200">{num(vals(m))}</td>)}
      <td className="px-2 py-2 text-right text-sm font-bold tabular-nums whitespace-nowrap border-l border-gray-200">{num(sum(Array.from({ length: 12 }, (_, i) => vals(i + 1))))}</td>
    </tr>
  )

  return (
    <main className="flex-1 p-3 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setYear((y) => y - 1)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Año anterior"><ChevronLeft className="h-4 w-4" /></button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Flujo de obligaciones {year}</h1>
            <p className="text-xs text-gray-500">Toca una celda para cambiar el monto o marcarla como pagada.</p>
          </div>
          <button onClick={() => setYear((y) => y + 1)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Año siguiente"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/finances/plan"><Btn size="sm" variant="outline">📌 Plan del mes</Btn></Link>
          <Btn size="sm" variant="outline" onClick={() => setHideEmpty((v) => !v)}>{hideEmpty ? "Ver los 12 meses" : "Solo meses con montos"}</Btn>
          <Btn size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Importar Excel</Btn>
          <Btn size="sm" variant="outline" onClick={() => exportExcel().catch(() => toast.error("No se pudo generar el Excel"))}><Download className="h-3.5 w-3.5" /> Excel</Btn>
          <Btn size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Concepto</Btn>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={onFile} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label={`Total ${year}`} value={yearTotal} />
        <Card label="Pagado" value={yearPaid} tone="text-emerald-600" />
        <Card label={curMonth >= 1 && curMonth <= 12 ? `Por pagar en ${MONTHS[curMonth - 1].toLowerCase()}` : "Pendiente"} value={curMonth >= 1 && curMonth <= 12 ? thisMonthPending : sum([yearTotal - yearPaid])} tone="text-amber-600" />
        <Card label="Vencido sin pagar" value={overdue} tone={overdue ? "text-red-600" : "text-gray-400"} hint="meses anteriores" />
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-gray-500">
        <span><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-100 mr-1" />Pagado</span>
        <span><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-100 mr-1" />Pendiente del mes</span>
        <span><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-100 mr-1" />Vencido sin pagar</span>
        <span>• = tiene nota</span>
        <span>$ = en dólares (los totales van en soles)</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        {loading && !items.length ? (
          <p className="p-6 text-center text-sm text-gray-500">Cargando…</p>
        ) : !rows.length ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-gray-500">Aún no hay obligaciones en {year}.</p>
            <div className="flex justify-center gap-2">
              <Btn size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Importar tu Excel</Btn>
              <Btn size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Agregar concepto</Btn>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr className="border-b border-gray-200">
                <th className="sticky left-0 z-20 bg-gray-50 px-2 py-2 text-left font-semibold">Concepto</th>
                {months.map((m) => (
                  <th key={m} className={cn("px-2 py-2 text-right font-semibold border-l border-gray-200 whitespace-nowrap", m === curMonth && "text-orange-600")}>{MONTHS[m - 1]}</th>
                ))}
                <th className="px-2 py-2 text-right font-semibold border-l border-gray-200">Total</th>
              </tr>
              {totalLine("Total del mes", monthTotal, "bg-gray-900 text-white")}
            </thead>
            <tbody>
              {blocks.map((b) => {
                if (b.kind === "row") return renderRow(b.row)
                const open = !collapsed.has(key(b.name))
                const gTotal = (m: number) => sum(b.rows.map((r) => amt(r, m)))
                return [
                  <tr key={`g-${b.name}`} className="border-b border-gray-200 bg-orange-50/70">
                    <td className="sticky left-0 z-10 bg-orange-50 px-2 py-1.5">
                      <button
                        onClick={() => setCollapsed((s) => { const n = new Set(s); if (n.has(key(b.name))) n.delete(key(b.name)); else n.add(key(b.name)); return n })}
                        className="flex items-center gap-1 text-sm font-bold text-orange-800"
                      >
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
                        Total {b.name} <span className="font-normal text-orange-600/70">· {b.rows.length}</span>
                      </button>
                    </td>
                    {months.map((m) => <td key={m} className="px-2 py-1.5 text-right text-sm font-bold text-orange-900 tabular-nums whitespace-nowrap border-l border-orange-100">{gTotal(m) ? num(gTotal(m)) : "—"}</td>)}
                    <td className="px-2 py-1.5 text-right text-sm font-bold text-orange-900 tabular-nums whitespace-nowrap border-l border-gray-200">{num(sum(Array.from({ length: 12 }, (_, i) => gTotal(i + 1))))}</td>
                  </tr>,
                  ...(open ? b.rows.map((r) => renderRow(r, true)) : []),
                ]
              })}
            </tbody>
            <tfoot>
              {totalLine("Pagado", monthPaid, "bg-emerald-50 text-emerald-800 border-t-2 border-gray-200")}
              {totalLine("Pendiente", (m) => sum([monthTotal(m) - monthPaid(m)]), "bg-amber-50 text-amber-800")}
            </tfoot>
          </table>
        )}
      </div>

      {cell && <CellModal key={`${cell.row?.key}-${cell.month}`} year={year} row={cell.row} month={cell.month} onClose={() => setCell(null)} onSave={(b, ok) => post(b, ok).then((r) => r && setCell(null))} />}
      {rowEdit && (
        <RowModal
          row={rowEdit}
          categories={categories}
          onClose={() => setRowEdit(null)}
          onMove={(d) => move(rowEdit, d)}
          onSave={(b, ok) => post(b, ok).then((r) => r && setRowEdit(null))}
        />
      )}
      {adding && <AddRowModal categories={categories} onClose={() => setAdding(false)} onSave={(b) => post(b, "Concepto agregado").then((r) => r && setAdding(false))} />}
      {preview && (
        <Modal open onClose={() => setPreview(null)} title="Importar cuadro de Excel">
          <div className="space-y-3 text-sm">
            <p>
              Se cargarán <b>{preview.rows.length} conceptos</b> de <b>{MONTHS[preview.months[0] - 1]}</b> a <b>{MONTHS[preview.months.at(-1)! - 1]}</b> en el año{" "}
              <b>{preview.year ?? year}</b>.
            </p>
            {[...new Set(preview.rows.map((r) => r.category).filter(Boolean))].map((g) => (
              <p key={g} className="text-xs text-gray-500">Grupo <b>{g}</b>: {preview.rows.filter((r) => r.category === g).map((r) => r.concept).join(", ")}</p>
            ))}
            <label className={cn("flex items-start gap-2 rounded-lg border p-2.5 text-xs", replaceAll ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 text-gray-600")}>
              <input type="checkbox" className="mt-0.5" checked={replaceAll} onChange={(e) => setReplaceAll(e.target.checked)} />
              <span>
                <b>Reemplazar todo con este Excel.</b> Se borran todas las obligaciones y gastos registrados antes (de todos los meses y años,
                también los de Gastos) y quedan solo los datos de este archivo, todos como pendientes.
              </span>
            </label>
            {!replaceAll && <p className="text-xs text-gray-500">Si un concepto ya existe en ese mes, se actualiza el monto y se mantiene si estaba pagado. Las filas de total se calculan solas.</p>}
            <div className="flex justify-end gap-2">
              <Btn variant="outline" onClick={() => setPreview(null)}>Cancelar</Btn>
              <Btn
                onClick={async () => {
                  const y = preview.year ?? year
                  try {
                    if (replaceAll && !confirm("Se borrarán todos los datos anteriores y quedará solo este Excel. ¿Continuar?")) return
                    const r = await api<{ created: number; updated: number; deleted?: number }>("/api/finances/obligations", "POST", { action: "import", year: y, rows: preview.rows, replaceAll })
                    toast.success(replaceAll ? `Listo: ${r.created} montos cargados (se borraron ${r.deleted ?? 0} anteriores)` : `Importado: ${r.created} montos nuevos, ${r.updated} actualizados`)
                    setPreview(null)
                    if (y !== year) setYear(y)
                    else load()
                  } catch (e) {
                    toast.error((e as Error).message)
                  }
                }}
              >
                Importar
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </main>
  )
}

function Card({ label, value, tone = "text-gray-900", hint }: { label: string; value: number; tone?: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={cn("text-xl font-bold tabular-nums", tone)}>S/ {num(value)}</p>
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

function CellModal({ year, row, month, onClose, onSave }: { year: number; row: Row | null; month: number; onClose: () => void; onSave: (body: object, ok: string) => void }) {
  const it = row?.cells[month]
  const [amount, setAmount] = useState(it?.amount ? String(it.amount) : "")
  const [paid, setPaid] = useState(it?.status === "PAGADO")
  const [notes, setNotes] = useState(it?.notes ?? "")
  const [forward, setForward] = useState(false)
  const base = it ?? Object.values(row?.cells ?? {})[0]
  const [currency, setCurrency] = useState(base?.currency === "USD" ? "USD" : "PEN")
  const [rate, setRate] = useState(String(base?.exchangeRate ?? 3.45))
  if (!row) return null
  // Plan del mes actual: la agrega al final de las prioridades, con fecha límite fin de mes
  async function addToPlan(expenseId: string) {
    const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7)
    try {
      await api("/api/finances/cash-plan", "POST", { month: ym, action: "addItems", expenseIds: [expenseId] })
      toast.success("Agregada al Plan del mes 📌")
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  const save = () => onSave({ action: "setCell", concept: row.concept, month, amount: Number(amount) || 0, currency, exchangeRate: Number(rate) || 3.45, status: paid ? "PAGADO" : "PENDIENTE", notes, applyForward: forward }, "Guardado")
  return (
    <Modal open onClose={onClose} title={`${row.concept} · ${MONTHS[month - 1]} ${year}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field label={currency === "USD" ? "Monto (US$)" : "Monto (S/)"}>
            <Input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && save()} />
          </Field>
          <Field label="Moneda">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm">
              <option value="PEN">S/</option>
              <option value="USD">US$</option>
            </select>
          </Field>
        </div>
        {currency === "USD" && (
          <Field label="Tipo de cambio" hint={`≈ S/ ${num((Number(amount) || 0) * (Number(rate) || 0))}`}>
            <Input type="number" inputMode="decimal" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setPaid(false)} className={cn("h-10 rounded-lg border text-sm font-semibold", !paid ? "border-amber-400 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-500")}>Pendiente</button>
          <button onClick={() => setPaid(true)} className={cn("h-10 rounded-lg border text-sm font-semibold", paid ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-500")}>✓ Pagado</button>
        </div>
        {it?.paidAt && paid && <p className="text-xs text-gray-500">Marcado como pagado el {new Date(it.paidAt).toLocaleDateString("es-PE")}</p>}
        <Field label="Nota (opcional)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="N.° de operación, fecha de vencimiento…" />
        </Field>
        {month < 12 && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={forward} onChange={(e) => setForward(e.target.checked)} />
            Usar este monto también de {MONTHS[month].toLowerCase()} a diciembre
          </label>
        )}
        <div className="flex flex-wrap justify-between gap-2 pt-1">
          {it && it.amount > 0 && it.status !== "PAGADO" ? (
            <Btn variant="outline" onClick={() => addToPlan(it.id)} title="Agregarla a los pagos priorizados de este mes">📌 Al plan del mes</Btn>
          ) : <span />}
          <div className="flex gap-2">
            <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={save}>Guardar</Btn>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function RowModal({ row, categories, onClose, onMove, onSave }: { row: Row; categories: string[]; onClose: () => void; onMove: (d: -1 | 1) => void; onSave: (body: object, ok: string) => void }) {
  const [name, setName] = useState(row.concept)
  const [category, setCategory] = useState(row.category ?? "")
  return (
    <Modal open onClose={onClose} title="Editar concepto">
      <div className="space-y-3">
        <Field label="Concepto"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Grupo (opcional)" hint="Las filas con el mismo grupo se suman en una fila de total, como SUNAT.">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} list="obl-groups" placeholder="Sin grupo" />
          <datalist id="obl-groups">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <div className="flex gap-2">
          <Btn size="sm" variant="outline" onClick={() => onMove(-1)}><ArrowUp className="h-3.5 w-3.5" /> Subir</Btn>
          <Btn size="sm" variant="outline" onClick={() => onMove(1)}><ArrowDown className="h-3.5 w-3.5" /> Bajar</Btn>
        </div>
        <div className="flex flex-wrap justify-between gap-2 pt-1">
          <Btn variant="danger" onClick={() => confirm(`¿Eliminar "${row.concept}" de todos los meses del año?`) && onSave({ action: "deleteRow", concept: row.concept }, "Concepto eliminado")}>Eliminar fila</Btn>
          <div className="flex gap-2">
            <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => onSave({ action: "editRow", concept: row.concept, newConcept: name, category }, "Guardado")}>Guardar</Btn>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function AddRowModal({ categories, onClose, onSave }: { categories: string[]; onClose: () => void; onSave: (body: object) => void }) {
  const [concept, setConcept] = useState("")
  const [amount, setAmount] = useState("")
  const [from, setFrom] = useState(new Date().getMonth() + 1)
  const [once, setOnce] = useState(false)
  const [category, setCategory] = useState("")
  const [usd, setUsd] = useState(false)
  return (
    <Modal open onClose={onClose} title="Nuevo concepto">
      <div className="space-y-3">
        <Field label="Concepto"><Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Alquiler del local" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={usd ? "Monto mensual (US$)" : "Monto mensual (S/)"}><Input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Desde">
            <select value={from} onChange={(e) => setFrom(Number(e.target.value))} className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} />
          Solo ese mes (pago único)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={usd} onChange={(e) => setUsd(e.target.checked)} />
          En dólares (tipo de cambio 3.45; se cambia en cada celda)
        </label>
        <Field label="Grupo (opcional)">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} list="obl-groups-new" placeholder="Sin grupo" />
          <datalist id="obl-groups-new">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
          <Btn disabled={!concept.trim()} onClick={() => onSave({ action: "addRow", concept, amount: Number(amount) || 0, fromMonth: from, onlyOneMonth: once, category, currency: usd ? "USD" : "PEN", exchangeRate: 3.45 })}>Agregar</Btn>
        </div>
      </div>
    </Modal>
  )
}
