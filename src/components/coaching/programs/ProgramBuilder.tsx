"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, Save, Users, Search } from "lucide-react"
import { GOALS, LEVELS, MUSCLE_GROUPS } from "@/lib/coaching/constants"
import { DAYS_OF_WEEK } from "@/lib/utils"
import { Btn, Field, Input, Modal, Panel, Select, Textarea, api } from "@/components/coaching/kit"

type ExRow = { key: string; exerciseId: string; sets: string; reps: string; restSec: string; rir: string; tempo: string; load: string; notes: string }
type Day = { id?: string; key: string; name: string; dayOfWeek: string; notes: string; exercises: ExRow[] }
type Program = {
  id: string; name: string; goal: string; level: string; description: string; weeks: number; isTemplate: boolean; isActive: boolean
  client: { id: string; name: string } | null; days: Day[]
}
type Exercise = { id: string; name: string; muscleGroup: string; equipment: string | null }

const uid = () => Math.random().toString(36).slice(2)
function move<T>(arr: T[], i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const copy = [...arr]
  ;[copy[i], copy[j]] = [copy[j], copy[i]]
  return copy
}

export default function ProgramBuilder({
  program,
  exercises,
  clients,
  basePath = "/coaching",
}: {
  program: Program
  exercises: Exercise[]
  clients: { id: string; name: string }[]
  /** Panel donde vive el editor: "/coaching" (coach) o "/trainer" (entrenador). */
  basePath?: string
}) {
  const router = useRouter()
  const [meta, setMeta] = useState({ name: program.name, goal: program.goal, level: program.level, description: program.description, weeks: String(program.weeks), isActive: program.isActive })
  const [days, setDays] = useState<Day[]>(program.days.length ? program.days : [{ key: uid(), name: "Día 1", dayOfWeek: "", notes: "", exercises: [] }])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [picker, setPicker] = useState<number | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault() }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [dirty])

  const update = (fn: (d: Day[]) => Day[]) => { setDays(fn); setDirty(true) }
  const updateDay = (i: number, patch: Partial<Day>) => update((d) => d.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  const updateEx = (di: number, ei: number, patch: Partial<ExRow>) =>
    update((d) => d.map((x, k) => (k === di ? { ...x, exercises: x.exercises.map((e, j) => (j === ei ? { ...e, ...patch } : e)) } : x)))

  function payload() {
    return {
      ...meta,
      days: days.map((d) => ({
        id: d.id,
        name: d.name,
        dayOfWeek: d.dayOfWeek,
        notes: d.notes,
        exercises: d.exercises.map((e) => ({ ...e })),
      })),
    }
  }

  async function save() {
    setSaving(true)
    try {
      const saved = await api<{ days: { id: string }[] }>(`/api/coaching/programs/${program.id}`, "PUT", payload())
      // sincroniza IDs de días nuevos para siguientes guardados
      setDays((d) => d.map((x, i) => ({ ...x, id: saved.days[i]?.id ?? x.id })))
      setDirty(false)
      toast.success("Rutina guardada")
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function duplicateAsTemplate() {
    if (dirty) await save()
    const p = await api<{ id: string }>("/api/coaching/programs", "POST", { copyFrom: program.id, name: `${meta.name} (copia)` })
    toast.success("Plantilla creada")
    router.push(`${basePath}/programs/${p.id}`)
  }

  async function assign() {
    if (!selected.length) return
    if (dirty) await save()
    try {
      await api(`/api/coaching/programs/${program.id}/assign`, "POST", { clientIds: selected })
      toast.success(`Asignada a ${selected.length} cliente(s)`)
      setAssignOpen(false)
      setSelected([])
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function remove() {
    if (!confirm("¿Eliminar esta rutina? El historial de entrenamientos del cliente se conserva.")) return
    await api(`/api/coaching/programs/${program.id}`, "DELETE")
    router.push(program.client ? `${basePath}/clients/${program.client.id}?tab=training` : `${basePath}/programs`)
  }

  const totalSets = days.reduce((a, d) => a + d.exercises.reduce((b, e) => b + (Number(e.sets) || 0), 0), 0)

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <Link href={program.client ? `${basePath}/clients/${program.client.id}?tab=training` : `${basePath}/programs`} className="text-xs text-gray-500 hover:text-gray-800">
            ← {program.client ? program.client.name : "Rutinas"}
          </Link>
          <h1 className="text-xl font-bold">{program.isTemplate ? "Plantilla de rutina" : `Rutina de ${program.client?.name}`}</h1>
          <p className="text-xs text-gray-500">{days.length} días · {totalSets} series totales/semana{dirty && <span className="text-amber-600"> · cambios sin guardar</span>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {program.isTemplate && <Btn variant="outline" onClick={() => setAssignOpen(true)}><Users className="h-4 w-4" /> Asignar a clientes</Btn>}
          <Btn variant="outline" onClick={duplicateAsTemplate}><Copy className="h-4 w-4" /> Duplicar como plantilla</Btn>
          <Btn variant="danger" onClick={remove}><Trash2 className="h-4 w-4" /></Btn>
          <Btn onClick={save} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar"}</Btn>
        </div>
      </div>

      <Panel>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Field label="Nombre" className="col-span-2"><Input value={meta.name} onChange={(e) => { setMeta({ ...meta, name: e.target.value }); setDirty(true) }} /></Field>
          <Field label="Objetivo">
            <Select value={meta.goal} onChange={(e) => { setMeta({ ...meta, goal: e.target.value }); setDirty(true) }}>
              <option value="">—</option>
              {GOALS.map((g) => <option key={g}>{g}</option>)}
            </Select>
          </Field>
          <Field label="Nivel">
            <Select value={meta.level} onChange={(e) => { setMeta({ ...meta, level: e.target.value }); setDirty(true) }}>
              <option value="">—</option>
              {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Semanas"><Input type="number" min={1} value={meta.weeks} onChange={(e) => { setMeta({ ...meta, weeks: e.target.value }); setDirty(true) }} /></Field>
          {!program.isTemplate && (
            <Field label="Estado">
              <Select value={meta.isActive ? "1" : "0"} onChange={(e) => { setMeta({ ...meta, isActive: e.target.value === "1" }); setDirty(true) }}>
                <option value="1">Activa (la ve el cliente)</option>
                <option value="0">Archivada</option>
              </Select>
            </Field>
          )}
          <Field label="Indicaciones generales" className="col-span-2 md:col-span-6">
            <Textarea value={meta.description} placeholder="Ej: Calentar 10 min. Última serie cerca del fallo. Progresar 2.5 kg cuando completes todas las reps." onChange={(e) => { setMeta({ ...meta, description: e.target.value }); setDirty(true) }} />
          </Field>
        </div>
      </Panel>

      <div className="space-y-4">
        {days.map((day, di) => (
          <Panel key={day.key}>
            <div className="flex flex-col md:flex-row gap-2 md:items-end mb-3">
              <Field label={`Día ${di + 1}`} className="flex-1"><Input value={day.name} onChange={(e) => updateDay(di, { name: e.target.value })} placeholder="Lunes — PUSH" className="font-semibold" /></Field>
              <Field label="Día sugerido" className="md:w-40">
                <Select value={day.dayOfWeek} onChange={(e) => updateDay(di, { dayOfWeek: e.target.value })}>
                  <option value="">Flexible</option>
                  {DAYS_OF_WEEK.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </Select>
              </Field>
              <div className="flex gap-1">
                <Btn size="sm" variant="ghost" onClick={() => update((d) => move(d, di, -1))} title="Subir"><ArrowUp className="h-4 w-4" /></Btn>
                <Btn size="sm" variant="ghost" onClick={() => update((d) => move(d, di, 1))} title="Bajar"><ArrowDown className="h-4 w-4" /></Btn>
                <Btn size="sm" variant="ghost" title="Duplicar día" onClick={() => update((d) => [...d.slice(0, di + 1), { ...day, id: undefined, key: uid(), name: `${day.name} (copia)`, exercises: day.exercises.map((e) => ({ ...e, key: uid() })) }, ...d.slice(di + 1)])}>
                  <Copy className="h-4 w-4" />
                </Btn>
                <Btn size="sm" variant="ghost" title="Eliminar día" onClick={() => { if (confirm(`¿Eliminar ${day.name}?`)) update((d) => d.filter((_, k) => k !== di)) }}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Btn>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm min-w-[860px]">
                <thead className="text-xs text-gray-500 text-left">
                  <tr>
                    <th className="pb-2 w-8">#</th>
                    <th className="pb-2">Ejercicio</th>
                    <th className="pb-2 w-16">Series</th>
                    <th className="pb-2 w-20">Reps</th>
                    <th className="pb-2 w-20">Desc. (s)</th>
                    <th className="pb-2 w-16">RIR</th>
                    <th className="pb-2 w-20">Tempo</th>
                    <th className="pb-2 w-24">Carga</th>
                    <th className="pb-2">Notas</th>
                    <th className="pb-2 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {day.exercises.map((ex, ei) => (
                    <tr key={ex.key} className="border-t border-gray-100">
                      <td className="py-1.5 text-gray-400 text-xs">{String(ei + 1).padStart(2, "0")}</td>
                      <td className="py-1.5 pr-2">
                        <button type="button" onClick={() => setPicker(di * 1000 + ei)} className="text-left font-medium hover:text-orange-600">
                          {exById.get(ex.exerciseId)?.name ?? "Elegir…"}
                        </button>
                        <p className="text-[11px] text-gray-400">{MUSCLE_GROUPS[exById.get(ex.exerciseId)?.muscleGroup ?? ""]}</p>
                      </td>
                      <td className="py-1.5 pr-1"><Input className="h-8" value={ex.sets} onChange={(e) => updateEx(di, ei, { sets: e.target.value })} /></td>
                      <td className="py-1.5 pr-1"><Input className="h-8" value={ex.reps} onChange={(e) => updateEx(di, ei, { reps: e.target.value })} /></td>
                      <td className="py-1.5 pr-1"><Input className="h-8" value={ex.restSec} onChange={(e) => updateEx(di, ei, { restSec: e.target.value })} /></td>
                      <td className="py-1.5 pr-1"><Input className="h-8" value={ex.rir} placeholder="2" onChange={(e) => updateEx(di, ei, { rir: e.target.value })} /></td>
                      <td className="py-1.5 pr-1"><Input className="h-8" value={ex.tempo} placeholder="3-1-1" onChange={(e) => updateEx(di, ei, { tempo: e.target.value })} /></td>
                      <td className="py-1.5 pr-1"><Input className="h-8" value={ex.load} placeholder="80 kg" onChange={(e) => updateEx(di, ei, { load: e.target.value })} /></td>
                      <td className="py-1.5 pr-1"><Input className="h-8" value={ex.notes} placeholder="Última serie al fallo" onChange={(e) => updateEx(di, ei, { notes: e.target.value })} /></td>
                      <td className="py-1.5 whitespace-nowrap text-right">
                        <button className="p-1 text-gray-400 hover:text-gray-700" onClick={() => update((d) => d.map((x, k) => (k === di ? { ...x, exercises: move(x.exercises, ei, -1) } : x)))}><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button className="p-1 text-gray-400 hover:text-gray-700" onClick={() => update((d) => d.map((x, k) => (k === di ? { ...x, exercises: move(x.exercises, ei, 1) } : x)))}><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button className="p-1 text-gray-400 hover:text-red-500" onClick={() => update((d) => d.map((x, k) => (k === di ? { ...x, exercises: x.exercises.filter((_, j) => j !== ei) } : x)))}><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col md:flex-row gap-2 mt-3">
              <Btn size="sm" variant="outline" onClick={() => setPicker(di * 1000 + 999)}><Plus className="h-3.5 w-3.5" /> Añadir ejercicio</Btn>
              <Input className="h-8 flex-1" placeholder="Notas del día (opcional)" value={day.notes} onChange={(e) => updateDay(di, { notes: e.target.value })} />
            </div>
          </Panel>
        ))}
        <Btn variant="outline" className="w-full" onClick={() => update((d) => [...d, { key: uid(), name: `Día ${d.length + 1}`, dayOfWeek: "", notes: "", exercises: [] }])}>
          <Plus className="h-4 w-4" /> Añadir día
        </Btn>
      </div>

      <ExercisePicker
        basePath={basePath}
        open={picker !== null}
        exercises={exercises}
        onClose={() => setPicker(null)}
        onPick={(exerciseId) => {
          if (picker === null) return
          const di = Math.floor(picker / 1000)
          const ei = picker % 1000
          if (ei === 999) {
            update((d) => d.map((x, k) => (k === di ? { ...x, exercises: [...x.exercises, { key: uid(), exerciseId, sets: "3", reps: "8-10", restSec: "90", rir: "2", tempo: "", load: "", notes: "" }] } : x)))
          } else {
            updateEx(di, ei, { exerciseId })
          }
          setPicker(null)
        }}
      />

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Asignar a clientes">
        <p className="text-xs text-gray-500 mb-2">Cada cliente recibe una copia que puedes personalizar. Su rutina activa actual se archivará.</p>
        <div className="max-h-72 overflow-y-auto divide-y border rounded-lg">
          {clients.map((c) => (
            <label key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <input type="checkbox" checked={selected.includes(c.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))} />
              {c.name}
            </label>
          ))}
          {!clients.length && <p className="p-3 text-sm text-gray-500">No hay clientes activos.</p>}
        </div>
        <Btn className="w-full mt-3" onClick={assign} disabled={!selected.length}>Asignar ({selected.length})</Btn>
      </Modal>
    </>
  )
}

function ExercisePicker({ open, exercises, onClose, onPick, basePath }: { open: boolean; exercises: Exercise[]; onClose: () => void; onPick: (id: string) => void; basePath: string }) {
  const [q, setQ] = useState("")
  const [group, setGroup] = useState("")
  const list = exercises.filter((e) => (!group || e.muscleGroup === group) && e.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Modal open={open} onClose={onClose} title="Elegir ejercicio">
      <div className="space-y-2">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
          <Input autoFocus className="pl-8" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button className={`text-xs px-2 py-1 rounded-full ${!group ? "bg-gray-900 text-white" : "bg-gray-100"}`} onClick={() => setGroup("")}>Todos</button>
          {Object.entries(MUSCLE_GROUPS).map(([k, v]) => (
            <button key={k} className={`text-xs px-2 py-1 rounded-full ${group === k ? "bg-gray-900 text-white" : "bg-gray-100"}`} onClick={() => setGroup(k)}>{v}</button>
          ))}
        </div>
        <div className="max-h-80 overflow-y-auto divide-y border rounded-lg">
          {list.map((e) => (
            <button key={e.id} className="w-full text-left px-3 py-2 hover:bg-orange-50" onClick={() => onPick(e.id)}>
              <p className="text-sm font-medium">{e.name}</p>
              <p className="text-xs text-gray-500">{MUSCLE_GROUPS[e.muscleGroup]}{e.equipment ? ` · ${e.equipment}` : ""}</p>
            </button>
          ))}
          {!list.length && (
            <p className="p-3 text-sm text-gray-500">
              Sin resultados. <Link href={`${basePath}/exercises`} className="text-orange-600">Crear ejercicio</Link>
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
