"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Btn, Input, Panel, api } from "@/components/coaching/kit"

type Candidate = { id: string; name: string; phone: string | null; inCoaching: boolean; measurements: number; personalTraining: boolean; consultations: number; membershipEnd: string | null; membershipActive: boolean }
type Report = { clients: number; created: number; updated: number; measurements: number; errors: string[] }

const FILTERS = [
  ["suggested", "Sugeridos"],
  ["membership", "Membresía vigente"],
  ["nutrition", "Con nutrición"],
  ["pt", "Con entrenamiento personal"],
  ["measures", "Con medidas"],
  ["coaching", "Ya en coaching"],
  ["all", "Todos"],
] as const

// Sugeridos: los que aún no están en coaching y tienen membresía vigente, entrenamiento personal o nutrición.
const isSuggested = (c: Candidate) => !c.inCoaching && (c.membershipActive || c.consultations > 0 || c.personalTraining)

export default function FortiaSync() {
  const router = useRouter()
  const [list, setList] = useState<Candidate[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("suggested")
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<Report | null>(null)

  useEffect(() => {
    api<Candidate[]>("/api/coaching/sync-fortia")
      .then((c) => {
        setList(c)
        setSelected(new Set(c.filter(isSuggested).map((x) => x.id)))
      })
      .catch((e) => toast.error((e as Error).message))
  }, [])

  const visible = useMemo(() => {
    if (!list) return []
    return list.filter((c) => {
      if (q && !`${c.name} ${c.phone ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false
      if (filter === "suggested") return isSuggested(c)
      if (filter === "membership") return c.membershipActive
      if (filter === "nutrition") return c.consultations > 0
      if (filter === "pt") return c.personalTraining
      if (filter === "measures") return c.measurements > 0
      if (filter === "coaching") return c.inCoaching
      return true
    })
  }, [list, q, filter])

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allVisibleSelected = visible.length > 0 && visible.every((c) => selected.has(c.id))

  async function run() {
    if (!selected.size) return
    if (!confirm(`¿Traer ${selected.size} cliente(s) al coaching con sus datos de FORTIA? Solo se agregan datos; no se borra nada.`)) return
    setBusy(true)
    try {
      const ids = [...selected]
      const total: Report = { clients: 0, created: 0, updated: 0, measurements: 0, errors: [] }
      for (let i = 0; i < ids.length; i += 25) {
        const r = await api<Report>("/api/coaching/sync-fortia", "POST", { clientIds: ids.slice(i, i + 25) })
        total.clients += r.clients; total.created += r.created; total.updated += r.updated; total.measurements += r.measurements; total.errors.push(...r.errors)
      }
      setReport(total)
      toast.success(`${total.created} clientes agregados al coaching`)
      setList(await api<Candidate[]>("/api/coaching/sync-fortia"))
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title={<span><span className="text-orange-500 mr-1">Paso 0.</span> 🏋️ Traer datos que ya tienes en FORTIA</span>}>
      <p className="text-xs text-gray-500 mb-3">
        Pasa al coaching a tus clientes del gimnasio con lo que ya registraste: contacto, membresía y pagos, entrenamiento personal, seguimiento físico y consultas de nutrición (objetivo, kcal y macros, agua, peso y medidas, alergias y condiciones médicas).
        No se borra ni se sobrescribe nada; puedes repetirlo cuando quieras.
      </p>
      {!list ? (
        <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando clientes…</p>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
              <Input className="pl-8" placeholder="Buscar cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {FILTERS.map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)} className={cn("shrink-0 text-xs px-3 py-1.5 rounded-full", filter === k ? "bg-gray-900 text-white" : "bg-gray-100")}>{l}</button>
              ))}
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto divide-y divide-gray-100">
            <label className="flex items-center gap-3 px-3 py-2 bg-gray-50 text-xs font-medium sticky top-0">
              <input type="checkbox" checked={allVisibleSelected} onChange={(e) => setSelected((s) => { const n = new Set(s); visible.forEach((c) => (e.target.checked ? n.add(c.id) : n.delete(c.id))); return n })} />
              Seleccionar {visible.length} visibles
            </label>
            {visible.map((c) => (
              <label key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <span className="flex-1">{c.name}</span>
                <span className="flex flex-wrap gap-1 justify-end">
                  {c.inCoaching && <span className="text-[10px] bg-emerald-50 text-emerald-700 rounded px-1.5">En coaching</span>}
                  {c.consultations > 0 && <span className="text-[10px] bg-orange-50 text-orange-700 rounded px-1.5">🥗 {c.consultations} consultas</span>}
                  {c.membershipEnd && (
                    <span className={cn("text-[10px] rounded px-1.5", c.membershipActive ? "bg-violet-50 text-violet-700" : "bg-gray-100 text-gray-400")}>
                      🎟️ {c.membershipActive ? "vence" : "venció"} {c.membershipEnd.split("-").reverse().slice(0, 2).join("/")}
                    </span>
                  )}
                  {c.personalTraining && <span className="text-[10px] bg-sky-50 text-sky-700 rounded px-1.5">🏋️ Personal</span>}
                  {c.measurements > 0 && <span className="text-[10px] bg-gray-100 text-gray-600 rounded px-1.5">📏 {c.measurements}</span>}
                </span>
              </label>
            ))}
            {!visible.length && <p className="p-3 text-sm text-gray-500">Sin clientes en este filtro.</p>}
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-500">{selected.size} seleccionados</span>
            <Btn onClick={run} disabled={busy || !selected.size}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Traer al coaching</Btn>
          </div>
          {report && (
            <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm">
              ✅ {report.clients} clientes procesados · {report.created} nuevos en coaching · {report.updated} completados · {report.measurements} medidas traídas de nutrición
              {report.errors.length > 0 && <p className="text-xs text-red-600 mt-1">{report.errors.length} con error: {report.errors.slice(0, 3).join(" · ")}</p>}
            </div>
          )}
        </>
      )}
    </Panel>
  )
}
