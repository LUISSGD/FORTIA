"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, PlayCircle, Search, BookOpen } from "lucide-react"
import { MUSCLE_GROUPS, embedUrl, techniqueSearchUrl } from "@/lib/coaching/constants"
import { Btn, Field, Input, Modal, Panel, Select, Textarea, api } from "@/components/coaching/kit"

type Exercise = {
  id: string; name: string; muscleGroup: string; primaryMuscle: string | null; secondaryMuscles: string | null; equipment: string | null
  videoUrl: string | null; imageUrl: string | null; instructions: string | null; commonMistakes: string | null; isCustom: boolean
}

const EMPTY = { name: "", muscleGroup: "PECHO", primaryMuscle: "", secondaryMuscles: "", equipment: "", videoUrl: "", imageUrl: "", instructions: "", commonMistakes: "" }

export default function ExerciseLibrary({ exercises }: { exercises: Exercise[] }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [group, setGroup] = useState("")
  const [editing, setEditing] = useState<Exercise | "new" | null>(null)
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)

  const list = exercises.filter((e) => (!group || e.muscleGroup === group) && `${e.name} ${e.primaryMuscle ?? ""} ${e.equipment ?? ""}`.toLowerCase().includes(q.toLowerCase()))

  function open(e: Exercise | "new") {
    setEditing(e)
    setF(e === "new" ? EMPTY : Object.fromEntries(Object.keys(EMPTY).map((k) => [k, (e as Record<string, unknown>)[k] ?? ""])) as typeof EMPTY)
  }

  async function save() {
    setBusy(true)
    try {
      if (editing === "new") await api("/api/coaching/exercises", "POST", f)
      else if (editing) await api(`/api/coaching/exercises/${editing.id}`, "PATCH", f)
      toast.success("Ejercicio guardado")
      setEditing(null)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!editing || editing === "new" || !confirm("¿Eliminar ejercicio? Si ya se usó, se archivará para conservar el historial.")) return
    await api(`/api/coaching/exercises/${editing.id}`, "DELETE")
    setEditing(null)
    router.refresh()
  }

  async function seed() {
    setBusy(true)
    try {
      const r = await api<{ exercises: number; foods: number }>("/api/coaching/library", "POST")
      toast.success(`${r.exercises} ejercicios y ${r.foods} alimentos añadidos`)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const embed = embedUrl(f.videoUrl)

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Biblioteca de ejercicios</h1>
          <p className="text-sm text-gray-500">{exercises.length} ejercicios · añade tus propios videos de técnica</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" onClick={seed} disabled={busy}><BookOpen className="h-4 w-4" /> Completar biblioteca base</Btn>
          <Btn onClick={() => open("new")}><Plus className="h-4 w-4" /> Nuevo ejercicio</Btn>
        </div>
      </div>

      <Panel>
        <div className="flex flex-col md:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
            <Input className="pl-8" placeholder="Buscar ejercicio, músculo o equipamiento…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            <button className={`shrink-0 text-xs px-3 py-1.5 rounded-full ${!group ? "bg-gray-900 text-white" : "bg-gray-100"}`} onClick={() => setGroup("")}>Todos</button>
            {Object.entries(MUSCLE_GROUPS).map(([k, v]) => (
              <button key={k} className={`shrink-0 text-xs px-3 py-1.5 rounded-full ${group === k ? "bg-gray-900 text-white" : "bg-gray-100"}`} onClick={() => setGroup(k)}>{v}</button>
            ))}
          </div>
        </div>
        {!exercises.length ? (
          <div className="text-center py-10">
            <p className="text-sm text-gray-500 mb-3">La biblioteca está vacía.</p>
            <Btn onClick={seed} disabled={busy}>Cargar 77 ejercicios base</Btn>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {list.map((e) => (
              <button key={e.id} onClick={() => open(e)} className="text-left rounded-xl border border-gray-200 p-3 hover:border-orange-300 hover:shadow-sm transition">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{e.name}</p>
                  {e.videoUrl && <PlayCircle className="h-4 w-4 text-orange-500 shrink-0" />}
                </div>
                <p className="text-xs text-gray-500">{MUSCLE_GROUPS[e.muscleGroup]} · {e.primaryMuscle}</p>
                {e.equipment && <p className="text-[11px] text-gray-400 mt-1">{e.equipment}</p>}
                {e.isCustom && <span className="text-[10px] bg-orange-50 text-orange-600 rounded px-1.5 mt-1 inline-block">Propio</span>}
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nuevo ejercicio" : "Editar ejercicio"} wide>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Field label="Nombre *"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Grupo muscular">
                <Select value={f.muscleGroup} onChange={(e) => setF({ ...f, muscleGroup: e.target.value })}>
                  {Object.entries(MUSCLE_GROUPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label="Músculo principal"><Input value={f.primaryMuscle} onChange={(e) => setF({ ...f, primaryMuscle: e.target.value })} /></Field>
            </div>
            <Field label="Músculos secundarios"><Input value={f.secondaryMuscles} onChange={(e) => setF({ ...f, secondaryMuscles: e.target.value })} /></Field>
            <Field label="Equipamiento"><Input value={f.equipment} onChange={(e) => setF({ ...f, equipment: e.target.value })} /></Field>
            <Field label="Video (YouTube, Vimeo o enlace)" hint="Sube tus videos a YouTube como “no listado” y pega el enlace."><Input value={f.videoUrl} onChange={(e) => setF({ ...f, videoUrl: e.target.value })} placeholder="https://youtu.be/…" /></Field>
            <Field label="Imagen (URL)"><Input value={f.imageUrl} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} /></Field>
          </div>
          <div className="space-y-3">
            {embed ? (
              <iframe src={embed} className="w-full aspect-video rounded-lg" allowFullScreen title="video" />
            ) : f.videoUrl ? (
              <a href={f.videoUrl} target="_blank" rel="noreferrer" className="text-sm text-orange-600">Abrir video →</a>
            ) : f.name ? (
              <a href={techniqueSearchUrl(f.name)} target="_blank" rel="noreferrer" className="block text-xs text-gray-500 bg-gray-50 rounded-lg p-3">Sin video propio. Buscar referencias en YouTube →</a>
            ) : null}
            <Field label="Instrucciones"><Textarea rows={4} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} /></Field>
            <Field label="Errores comunes"><Textarea rows={3} value={f.commonMistakes} onChange={(e) => setF({ ...f, commonMistakes: e.target.value })} /></Field>
          </div>
        </div>
        <div className="flex justify-between mt-4">
          {editing !== "new" ? <Btn variant="danger" onClick={remove}>Eliminar</Btn> : <span />}
          <Btn onClick={save} disabled={busy || !f.name}>Guardar</Btn>
        </div>
      </Modal>
    </>
  )
}
