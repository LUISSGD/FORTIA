"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Download, Filter, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ClientOverview } from "@/lib/coaching/stats"
import { formatYmd } from "@/lib/coaching/dates"
import { Btn, Field, Input, Modal, Panel, StatusDot, api } from "@/components/coaching/kit"

// Tabla de clientes con filtros y orden por columna, al estilo de Excel.

type Row = ClientOverview & { hasApp: boolean }
type Col = {
  key: string
  label: string
  sort: (c: Row) => number | string | null
  filter: (c: Row) => string
  cell: (c: Row) => React.ReactNode
  /** Orden fijo de las opciones del filtro (si no, alfabético). */
  order?: string[]
}

const pctTone = (v: number | null) => (v === null ? "text-gray-400" : v >= 80 ? "text-emerald-600" : v >= 60 ? "text-amber-600" : "text-red-600")
const pctBucket = (v: number | null) => (v === null ? "Sin datos" : v >= 80 ? "80–100 %" : v >= 60 ? "60–79 %" : "Menos de 60 %")
const PCT_ORDER = ["80–100 %", "60–79 %", "Menos de 60 %", "Sin datos"]

const STATE_LABEL = (c: Row) =>
  c.status === "STANDBY" ? "💤 Stand-by" : c.status === "PAUSED" ? "⏸️ Pausado" : c.level === "red" ? "🔴 Requiere atención" : c.level === "yellow" ? "🟡 Revisar" : "🟢 Bien"

const MEMBERSHIP_LABEL: Record<Row["membership"]["state"], string> = {
  active: "Vigente",
  warning: "Vence en 10 días o menos",
  urgent: "Vence en 5 días o menos",
  expired: "Vencida",
  none: "Sin membresía",
}

const PAY: Record<Row["payState"], { label: string; text: string; cls: string }> = {
  ok: { label: "🟢 Al día", text: "Al día", cls: "text-emerald-600" },
  soon: { label: "⏳ Por vencer", text: "Por vencer", cls: "text-amber-600" },
  pending: { label: "⏳ Pendiente", text: "Pendiente", cls: "text-amber-600" },
  overdue: { label: "🔴 Vencido", text: "Vencido", cls: "text-red-600 font-medium" },
  none: { label: "Sin plan", text: "Sin plan", cls: "text-gray-400" },
}

const COLS: Col[] = [
  {
    key: "name", label: "Cliente", sort: (c) => c.name.toLowerCase(), filter: STATE_LABEL,
    order: ["🔴 Requiere atención", "🟡 Revisar", "🟢 Bien", "⏸️ Pausado", "💤 Stand-by"],
    cell: (c) => (
      <Link href={`/coaching/clients/${c.id}`} className="flex items-center gap-2 font-medium text-gray-900 hover:text-orange-600">
        <StatusDot level={c.status === "ACTIVE" ? c.level : "gray"} />
        {c.name}
        {c.status === "PAUSED" && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 rounded">Pausado</span>}
        {c.status === "STANDBY" && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 rounded">Stand-by</span>}
        {c.unreadMessages > 0 && <span className="text-[10px] bg-orange-500 text-white px-1.5 rounded-full">{c.unreadMessages}</span>}
      </Link>
    ),
  },
  { key: "goal", label: "Objetivo", sort: (c) => c.goal, filter: (c) => c.goal ?? "(Vacío)", cell: (c) => <span className="text-gray-600">{c.goal ?? "—"}</span> },
  {
    key: "plan", label: "Plan", sort: (c) => c.membership.planName, filter: (c) => c.membership.planName ?? "(Sin plan)",
    cell: (c) => <span className="text-gray-600 text-xs">{c.membership.planName ?? "—"}</span>,
  },
  {
    key: "membership", label: "Membresía", sort: (c) => c.membership.end, filter: (c) => MEMBERSHIP_LABEL[c.membership.state],
    order: ["Vencida", "Vence en 5 días o menos", "Vence en 10 días o menos", "Vigente", "Sin membresía"],
    cell: (c) =>
      c.membership.state === "none" ? (
        <span className="text-gray-400">—</span>
      ) : (
        <span className={c.membership.state === "expired" || c.membership.state === "urgent" ? "text-red-600 font-medium" : c.membership.state === "warning" ? "text-amber-600" : "text-gray-600"}>
          {c.membership.state === "expired" ? "Vencida " : "Vence "}{formatYmd(c.membership.end!)}
        </span>
      ),
  },
  {
    key: "pay", label: "Pago", sort: (c) => ["overdue", "pending", "soon", "ok", "none"].indexOf(c.payState), filter: (c) => PAY[c.payState].label,
    order: ["🔴 Vencido", "⏳ Pendiente", "⏳ Por vencer", "🟢 Al día", "Sin plan"],
    cell: (c) => <span className={PAY[c.payState].cls}>{PAY[c.payState].label}</span>,
  },
  {
    key: "last", label: "Último entreno", sort: (c) => c.daysSinceWorkout ?? 9999,
    filter: (c) => (c.daysSinceWorkout === null ? "Nunca" : c.daysSinceWorkout === 0 ? "Hoy" : c.daysSinceWorkout <= 2 ? "Hace 1–2 días" : c.daysSinceWorkout <= 6 ? "Hace 3–6 días" : "Hace 7 días o más"),
    order: ["Hoy", "Hace 1–2 días", "Hace 3–6 días", "Hace 7 días o más", "Nunca"],
    cell: (c) => <span className="text-gray-600">{c.lastWorkout ? `${formatYmd(c.lastWorkout)} (${c.daysSinceWorkout === 0 ? "hoy" : `hace ${c.daysSinceWorkout} d`})` : "—"}</span>,
  },
  {
    key: "week", label: "Semana", sort: (c) => c.workoutsThisWeek,
    filter: (c) => (c.workoutsThisWeek >= c.trainingDays ? "Cumplió la meta" : c.workoutsThisWeek > 0 ? "En progreso" : "Sin sesiones"),
    order: ["Cumplió la meta", "En progreso", "Sin sesiones"],
    cell: (c) => <>{c.workoutsThisWeek}/{c.trainingDays}</>,
  },
  {
    key: "training", label: "Entreno 7d", sort: (c) => c.trainingAdherence, filter: (c) => pctBucket(c.trainingAdherence), order: PCT_ORDER,
    cell: (c) => <span className={cn("font-medium", pctTone(c.trainingAdherence))}>{c.trainingAdherence === null ? "—" : `${c.trainingAdherence}%`}</span>,
  },
  {
    key: "nutrition", label: "Nutrición 7d", sort: (c) => c.nutritionCompliance, filter: (c) => pctBucket(c.nutritionCompliance), order: PCT_ORDER,
    cell: (c) => <span className={cn("font-medium", pctTone(c.nutritionCompliance))}>{c.nutritionCompliance === null ? "—" : `${c.nutritionCompliance}%`}</span>,
  },
  {
    key: "checkin", label: "Check-in", sort: (c) => c.lastCheckIn,
    filter: (c) => (c.checkInThisWeek ? "Esta semana" : c.lastCheckIn ? "Semanas anteriores" : "Nunca"),
    order: ["Esta semana", "Semanas anteriores", "Nunca"],
    cell: (c) => <>{c.checkInThisWeek ? "✅" : c.lastCheckIn ? formatYmd(c.lastCheckIn) : "—"}</>,
  },
  { key: "weight", label: "Peso", sort: (c) => c.lastWeight, filter: (c) => (c.lastWeight ? "Con peso" : "Sin peso"), cell: (c) => <>{c.lastWeight ? `${c.lastWeight} kg` : "—"}</> },
  {
    key: "app", label: "App", sort: (c) => (c.hasApp ? 0 : 1), filter: (c) => (c.hasApp ? "Con acceso" : "Sin acceso"), order: ["Con acceso", "Sin acceso"],
    cell: (c) => (c.hasApp
      ? <span className="text-emerald-600 text-xs font-medium">✓ Con acceso</span>
      : <QuickAccessTrigger id={c.id} name={c.name} email={c.email} />
    ),
  },
]

const TABS = [
  ["active", "Activos"],
  ["standby", "Stand-by / ex clientes"],
  ["all", "Todos"],
] as const
type TabKey = (typeof TABS)[number][0]
type Sort = { key: string; dir: 1 | -1 } | null
const STORE = "fortia.coaching.clients.table"

/** Compara en la dirección pedida; los vacíos siempre van al final, como en Excel. */
function compare(a: number | string | null, b: number | string | null, dir: 1 | -1) {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "es")) * dir
}

export default function ClientsTable({ rows }: { rows: Row[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>("active")
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [sort, setSort] = useState<Sort>(null)
  const [open, setOpen] = useState<{ key: string; rect: DOMRect } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const loaded = useRef(false)

  // Recordar filtros y orden en este navegador.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? "null")
      if (saved) {
        if (saved.tab) setTab(saved.tab)
        if (saved.filters) setFilters(saved.filters)
        if (saved.sort !== undefined) setSort(saved.sort)
      }
    } catch {}
    loaded.current = true
  }, [])
  useEffect(() => {
    if (!loaded.current) return
    try { localStorage.setItem(STORE, JSON.stringify({ tab, filters, sort })) } catch {}
  }, [tab, filters, sort])

  const counts = useMemo(() => ({
    active: rows.filter((r) => r.status !== "STANDBY").length,
    standby: rows.filter((r) => r.status === "STANDBY").length,
    all: rows.length,
  }), [rows])

  const base = useMemo(
    () => rows.filter((r) => (tab === "all" ? true : tab === "standby" ? r.status === "STANDBY" : r.status !== "STANDBY")),
    [rows, tab],
  )

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = base.filter((r) => {
      if (term && !`${r.name} ${r.phone ?? ""} ${r.goal ?? ""} ${r.membership.planName ?? ""}`.toLowerCase().includes(term)) return false
      return COLS.every((col) => !filters[col.key] || filters[col.key].includes(col.filter(r)))
    })
    if (sort) {
      const col = COLS.find((c) => c.key === sort.key)
      if (col) list.sort((a, b) => compare(col.sort(a), col.sort(b), sort.dir))
    }
    return list
  }, [base, q, filters, sort])

  const activeFilters = Object.keys(filters).length
  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.id))

  function toggleAll(checked: boolean) {
    setSelected((s) => {
      const n = new Set(s)
      visible.forEach((r) => (checked ? n.add(r.id) : n.delete(r.id)))
      return n
    })
  }

  async function setStatus(status: "ACTIVE" | "PAUSED" | "STANDBY") {
    const ids = [...selected]
    const label = status === "STANDBY" ? "stand-by (ex cliente)" : status === "PAUSED" ? "pausado" : "activo"
    if (!confirm(`¿Pasar ${ids.length} cliente(s) a ${label}?`)) return
    setBusy(true)
    try {
      const r = await api<{ updated: number }>("/api/coaching/clients/status", "POST", { clientIds: ids, status })
      toast.success(`${r.updated} cliente(s) actualizados`)
      setSelected(new Set())
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  /** Descarga la vista actual (o los seleccionados) como Excel .xlsx: columnas, fechas y números reales. */
  async function exportExcel() {
    const list = selected.size ? visible.filter((r) => selected.has(r.id)) : visible
    const { default: ExcelJS } = await import("exceljs")
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Clientes", { views: [{ state: "frozen", ySplit: 1 }] })
    const date = (ymd: string | null | undefined) => (ymd && /^\d{4}-\d{2}-\d{2}/.test(ymd) ? new Date(`${ymd.slice(0, 10)}T12:00:00Z`) : null)
    const pct = (v: number | null | undefined) => (v === null || v === undefined ? null : v / 100)
    ws.columns = [
      { header: "Cliente", key: "name", width: 28 },
      { header: "Teléfono", key: "phone", width: 14 },
      { header: "Estado", key: "state", width: 18 },
      { header: "Objetivo", key: "goal", width: 22 },
      { header: "Plan", key: "plan", width: 44 },
      { header: "Vencimiento", key: "end", width: 13, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Membresía", key: "membership", width: 24 },
      { header: "Pago", key: "pay", width: 12 },
      { header: "Último entreno", key: "lastWorkout", width: 15, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Semana", key: "week", width: 9 },
      { header: "Entreno 7d", key: "training", width: 11, style: { numFmt: "0%" } },
      { header: "Nutrición 7d", key: "nutrition", width: 12, style: { numFmt: "0%" } },
      { header: "Último check-in", key: "checkIn", width: 15, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Peso kg", key: "weight", width: 9, style: { numFmt: "0.0" } },
      { header: "App", key: "app", width: 7 },
    ]
    for (const r of list) {
      ws.addRow({
        name: r.name.replace(/\s+/g, " ").trim(), phone: r.phone ?? "", state: STATE_LABEL(r).replace(/^\S+\s/, ""), goal: r.goal ?? "",
        plan: r.membership.planName ?? "", end: date(r.membership.end), membership: MEMBERSHIP_LABEL[r.membership.state], pay: PAY[r.payState].text,
        lastWorkout: date(r.lastWorkout), week: `${r.workoutsThisWeek}/${r.trainingDays}`, training: pct(r.trainingAdherence), nutrition: pct(r.nutritionCompliance),
        checkIn: date(r.lastCheckIn), weight: r.lastWeight ?? null, app: r.hasApp ? "Sí" : "No",
      })
    }
    const head = ws.getRow(1)
    head.font = { bold: true, color: { argb: "FFFFFFFF" } }
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF97316" } }
    head.alignment = { vertical: "middle" }
    head.height = 20
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } }

    const buf = await wb.xlsx.writeBuffer()
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `clientes-coaching-${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date())}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 justify-between">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => { setTab(k); setSelected(new Set()) }}
              className={cn("shrink-0 text-xs px-3 py-1.5 rounded-full", tab === k ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600")}
            >
              {l} <span className="opacity-60">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 lg:w-72">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
            <Input className="pl-8" placeholder="Buscar nombre, teléfono, plan…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {(activeFilters > 0 || sort) && (
            <Btn variant="outline" size="sm" onClick={() => { setFilters({}); setSort(null) }}>
              <X className="h-3.5 w-3.5" /> Quitar filtros{activeFilters ? ` (${activeFilters})` : ""}
            </Btn>
          )}
          <Btn variant="outline" size="sm" onClick={() => exportExcel().catch(() => toast.error("No se pudo generar el Excel"))} title="Descargar la vista actual para abrir en Excel">
            <Download className="h-3.5 w-3.5" /> Excel
          </Btn>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm">
          <span className="font-medium mr-2">{selected.size} seleccionado(s)</span>
          <Btn size="sm" variant="outline" disabled={busy} onClick={() => setStatus("STANDBY")}>💤 Pasar a stand-by</Btn>
          <Btn size="sm" variant="outline" disabled={busy} onClick={() => setStatus("ACTIVE")}>✅ Reactivar</Btn>
          <Btn size="sm" variant="outline" disabled={busy} onClick={() => setStatus("PAUSED")}>⏸️ Pausar</Btn>
          <button className="ml-auto text-xs text-gray-300 underline" onClick={() => setSelected(new Set())}>Deseleccionar</button>
        </div>
      )}

      <Panel className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 text-left">
              <tr>
                <th className="pl-4 pr-1 py-2.5 w-6">
                  <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} aria-label="Seleccionar todos" />
                </th>
                {COLS.map((col, i) => (
                  <th key={col.key} className="px-3 py-2.5 font-medium whitespace-nowrap relative">
                    <button
                      onClick={(e) => setOpen(open?.key === col.key ? null : { key: col.key, rect: e.currentTarget.getBoundingClientRect() })}
                      className={cn("inline-flex items-center gap-1 hover:text-gray-900", (filters[col.key] || sort?.key === col.key) && "text-orange-600")}
                    >
                      {col.label}
                      {sort?.key === col.key && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      <Filter className={cn("h-3 w-3", filters[col.key] ? "fill-orange-500 text-orange-500" : "opacity-40")} />
                    </button>
                    {open?.key === col.key && (
                      <FilterMenu
                        col={col}
                        rows={base}
                        value={filters[col.key]}
                        sortDir={sort?.key === col.key ? sort.dir : null}
                        anchor={open.rect}
                        alignRight={i > COLS.length - 4}
                        onSort={(dir) => { setSort(dir ? { key: col.key, dir } : null); setOpen(null) }}
                        onChange={(v) => setFilters((f) => { const n = { ...f }; if (v) n[col.key] = v; else delete n[col.key]; return n })}
                        onClose={() => setOpen(null)}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={COLS.length + 1} className="text-center text-gray-500 py-10">
                    {rows.length === 0 ? "Aún no tienes clientes de coaching. Usa “Agregar cliente” o Importar → Paso 0." : "Ningún cliente coincide con los filtros."}
                  </td>
                </tr>
              )}
              {visible.map((c) => (
                <tr key={c.id} className={cn("hover:bg-gray-50", selected.has(c.id) && "bg-orange-50/60", c.status === "STANDBY" && "opacity-70")}>
                  <td className="pl-4 pr-1 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })}
                      aria-label={`Seleccionar ${c.name}`}
                    />
                  </td>
                  {COLS.map((col) => (
                    <td key={col.key} className={cn("px-3 py-2.5 whitespace-nowrap", col.key === "name" && "pl-2")}>{col.cell(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
          Mostrando {visible.length} de {base.length}
        </div>
      </Panel>
    </>
  )
}

function QuickAccessTrigger({ id, name, email }: { id: string; name: string; email: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ email: email ?? "", password: "" })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.email) return toast.error("El email es obligatorio")
    if (form.password.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres")
    setSaving(true)
    try {
      await api(`/api/coaching/clients/${id}/access`, "POST", form)
      toast.success(`Acceso creado para ${name}`)
      setOpen(false)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className="text-[10px] bg-amber-50 text-amber-700 hover:bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 transition-colors"
      >
        + Dar acceso
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Dar acceso a ${name}`}>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Crea el usuario con el que <b>{name}</b> iniciará sesión en la app.</p>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@ejemplo.com"
              autoFocus
            />
          </Field>
          <Field label="Contraseña (mín. 6 caracteres)">
            <Input
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="········"
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Btn variant="outline" onClick={() => setOpen(false)}>Cancelar</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? "Creando…" : "Crear acceso"}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}

function FilterMenu({ col, rows, value, sortDir, anchor, alignRight, onSort, onChange, onClose }: {
  col: Col
  rows: Row[]
  value: string[] | undefined
  sortDir: 1 | -1 | null
  anchor: DOMRect
  alignRight: boolean
  onSort: (dir: 1 | -1 | null) => void
  onChange: (v: string[] | undefined) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    const onScroll = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onClose)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onClose)
    }
  }, [onClose])

  const options = useMemo(() => {
    const count = new Map<string, number>()
    rows.forEach((r) => { const v = col.filter(r); count.set(v, (count.get(v) ?? 0) + 1) })
    const keys = [...count.keys()].sort((a, b) => {
      if (col.order) {
        const ia = col.order.indexOf(a), ib = col.order.indexOf(b)
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      }
      return a.localeCompare(b, "es")
    })
    return keys.map((k) => ({ label: k, count: count.get(k)! }))
  }, [rows, col])

  const shown = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
  const checked = (label: string) => !value || value.includes(label)
  const allLabels = options.map((o) => o.label)

  function toggle(label: string) {
    const current = value ?? allLabels
    const next = current.includes(label) ? current.filter((x) => x !== label) : [...current, label]
    onChange(next.length === allLabels.length ? undefined : next)
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 rounded-xl border border-gray-200 bg-white shadow-lg p-2 text-gray-700 font-normal normal-case"
      style={{ top: anchor.bottom + 6, left: Math.max(8, Math.min(alignRight ? anchor.right - 256 : anchor.left, window.innerWidth - 264)) }}
    >
      <button onClick={() => onSort(sortDir === 1 ? null : 1)} className={cn("w-full flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50", sortDir === 1 && "text-orange-600 font-medium")}>
        <ArrowUp className="h-3.5 w-3.5" /> Ordenar de A a Z / menor a mayor
      </button>
      <button onClick={() => onSort(sortDir === -1 ? null : -1)} className={cn("w-full flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50", sortDir === -1 && "text-orange-600 font-medium")}>
        <ArrowDown className="h-3.5 w-3.5" /> Ordenar de Z a A / mayor a menor
      </button>
      <div className="border-t border-gray-100 my-1.5" />
      {options.length > 6 && (
        <Input className="h-8 text-xs mb-1.5" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
      )}
      <div className="max-h-60 overflow-y-auto">
        <label className="flex items-center gap-2 px-2 py-1 text-xs font-medium cursor-pointer hover:bg-gray-50 rounded">
          <input type="checkbox" checked={!value} onChange={(e) => onChange(e.target.checked ? undefined : [])} />
          (Seleccionar todo)
        </label>
        {shown.map((o) => (
          <label key={o.label} className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-gray-50 rounded">
            <input type="checkbox" checked={checked(o.label)} onChange={() => toggle(o.label)} />
            <span className="flex-1 truncate">{o.label}</span>
            <span className="text-gray-400">{o.count}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-between border-t border-gray-100 mt-1.5 pt-1.5">
        <button onClick={() => onChange(undefined)} className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1">Limpiar filtro</button>
        <button onClick={onClose} className="text-xs bg-orange-500 text-white rounded-lg px-3 py-1">Aceptar</button>
      </div>
    </div>
  )
}
