"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, ChevronDown, Play, Plus, Timer, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { estimate1RM, fmtKg } from "@/lib/coaching/workout"
import { request } from "./request"

type Prev = { weight: number | null; reps: number | null }
type Ex = {
  id: string; exerciseId: string; name: string; sets: number; reps: string; restSec: number; rir: string | null; tempo: string | null; load: string | null
  notes: string | null; videoEmbed: string | null; videoUrl: string; instructions: string | null; previous: Prev[]; best1RM: number
}
type SetState = { weight: string; reps: string; done: boolean }
type State = { startedAt: string; sets: Record<string, SetState[]>; notes: Record<string, string>; completed: Record<string, boolean> }

const pad = (n: number) => String(n).padStart(2, "0")
const clock = (s: number) => `${Math.floor(s / 60)}:${pad(s % 60)}`

function initialState(exercises: Ex[]): State {
  return {
    startedAt: new Date().toISOString(),
    sets: Object.fromEntries(
      exercises.map((e) => [
        e.id,
        Array.from({ length: Math.max(e.sets, 1) }, (_, i) => {
          const p = e.previous[i] ?? e.previous.at(-1)
          return { weight: p?.weight ? String(p.weight) : "", reps: "", done: false }
        }),
      ])
    ),
    notes: {},
    completed: {},
  }
}

export default function WorkoutPlayer({ dayId, title, subtitle, notes, exercises }: { dayId: string; title: string; subtitle: string; notes: string | null; exercises: Ex[] }) {
  const router = useRouter()
  const storageKey = `fortia-workout-${dayId}`
  const [state, setState] = useState<State>(() => initialState(exercises))
  const [open, setOpen] = useState<string | null>(exercises[0]?.id ?? null)
  const [elapsed, setElapsed] = useState(0)
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null)
  const [restLeft, setRestLeft] = useState(0)
  const [video, setVideo] = useState<Ex | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [rating, setRating] = useState(4)
  const [finalNotes, setFinalNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [summary, setSummary] = useState<{ duration: number; exercises: number; volume: number; sets: number; prs: string[] } | null>(null)
  const loaded = useRef(false)

  // Restaurar progreso guardado (si el cliente cerró la app a mitad de sesión)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const saved = JSON.parse(raw) as State
        if (Date.now() - new Date(saved.startedAt).getTime() < 12 * 3600_000) {
          setState((s) => ({ ...s, ...saved, sets: { ...s.sets, ...saved.sets } }))
          toast.info("Retomamos tu entrenamiento donde lo dejaste")
        }
      }
    } catch {}
    loaded.current = true
  }, [storageKey])

  useEffect(() => {
    if (!loaded.current || summary) return
    try { localStorage.setItem(storageKey, JSON.stringify(state)) } catch {}
  }, [state, storageKey, summary])

  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000))
      if (rest) {
        const left = Math.max(0, Math.round((rest.until - Date.now()) / 1000))
        setRestLeft(left)
        if (left === 0) {
          setRest(null)
          if (navigator.vibrate) navigator.vibrate([200, 100, 200])
        }
      }
    }, 500)
    return () => clearInterval(t)
  }, [state.startedAt, rest])

  const updateSet = useCallback((exId: string, i: number, patch: Partial<SetState>) => {
    setState((s) => ({ ...s, sets: { ...s.sets, [exId]: s.sets[exId].map((x, k) => (k === i ? { ...x, ...patch } : x)) } }))
  }, [])

  function toggleSet(ex: Ex, i: number) {
    const set = state.sets[ex.id][i]
    if (!set.done) {
      const prev = ex.previous[i] ?? ex.previous.at(-1)
      const reps = set.reps || (prev?.reps ? String(prev.reps) : "") || ex.reps.split(/[-–]/).pop()?.replace(/\D/g, "") || ""
      if (!reps) return toast.error("Indica las repeticiones")
      updateSet(ex.id, i, { done: true, reps })
      if (ex.restSec > 0) {
        setRest({ until: Date.now() + ex.restSec * 1000, total: ex.restSec })
        setRestLeft(ex.restSec)
      }
    } else {
      updateSet(ex.id, i, { done: false })
    }
  }

  function completeExercise(ex: Ex, idx: number) {
    setState((s) => ({ ...s, completed: { ...s.completed, [ex.id]: true } }))
    setOpen(exercises[idx + 1]?.id ?? null)
  }

  const stats = useMemo(() => {
    let volume = 0
    let sets = 0
    exercises.forEach((e) => state.sets[e.id]?.forEach((s) => {
      if (s.done) { sets++; volume += (Number(s.weight) || 0) * (Number(s.reps) || 0) }
    }))
    return { volume: Math.round(volume), sets }
  }, [state, exercises])

  async function finish() {
    setSaving(true)
    const payload = {
      programDayId: dayId,
      startedAt: state.startedAt,
      rating,
      notes: finalNotes,
      exerciseNotes: state.notes,
      sets: exercises.flatMap((e) => state.sets[e.id].map((s, i) => ({ exerciseId: e.exerciseId, setNumber: i + 1, weight: s.weight, reps: s.reps, completed: s.done })).filter((s) => s.completed)),
    }
    let data: { durationMin: number; volumeKg: number }
    try {
      data = await request("/api/app/workouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, 30_000)
    } catch (e) {
      toast.error(`${(e as Error).message} Tu entrenamiento sigue guardado en este celular.`, { duration: 8000 })
      return
    } finally {
      setSaving(false)
    }
    const prs = exercises
      .filter((e) => {
        const top = Math.max(0, ...state.sets[e.id].filter((s) => s.done).map((s) => estimate1RM(Number(s.weight) || 0, Number(s.reps) || 0)))
        return e.best1RM > 0 && top > e.best1RM + 0.01
      })
      .map((e) => e.name)
    try { localStorage.removeItem(storageKey) } catch {}
    setFinishing(false)
    setSummary({ duration: data.durationMin, exercises: exercises.filter((e) => state.sets[e.id].some((s) => s.done)).length, volume: Math.round(data.volumeKg), sets: stats.sets, prs })
    router.refresh()
  }

  if (summary) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-6">
        <p className="text-6xl">🎉</p>
        <div>
          <h1 className="text-2xl font-black">ENTRENAMIENTO COMPLETADO</h1>
          <p className="text-zinc-400">{title}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 w-full">
          {[["Duración", `${summary.duration} min`], ["Ejercicios", summary.exercises], ["Volumen", `${summary.volume.toLocaleString("es-PE")} kg`]].map(([l, v]) => (
            <div key={l as string} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{l}</p>
              <p className="text-lg font-black">{v}</p>
            </div>
          ))}
        </div>
        {summary.prs.length > 0 && (
          <div className="rounded-2xl bg-orange-500/10 border border-orange-500/30 p-4 w-full">
            <p className="font-bold text-orange-400">🏆 ¡Nuevo récord personal!</p>
            <p className="text-sm text-zinc-300">{summary.prs.join(", ")}</p>
          </div>
        )}
        <Link href="/app" className="w-full h-12 rounded-xl bg-orange-500 font-bold flex items-center justify-center">VOLVER AL INICIO</Link>
        <Link href="/app/chat" className="text-sm text-zinc-400">Contarle a tu coach cómo te fue →</Link>
      </div>
    )
  }

  const doneCount = exercises.filter((e) => state.completed[e.id]).length

  return (
    <div className="space-y-3 -mt-2">
      <div className="sticky top-14 z-30 -mx-4 px-4 py-3 bg-zinc-950/95 backdrop-blur border-b border-zinc-900">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-orange-400 font-bold">🔥 Entrenamiento de hoy</p>
            <p className="font-black truncate">{title} <span className="text-zinc-500 font-medium text-sm">· {subtitle}</span></p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono font-bold text-lg">{clock(elapsed)}</p>
            <p className="text-[10px] text-zinc-500">{doneCount}/{exercises.length} · {stats.volume.toLocaleString("es-PE")} kg</p>
          </div>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-orange-500 transition-all" style={{ width: `${(doneCount / Math.max(1, exercises.length)) * 100}%` }} />
        </div>
      </div>

      {notes && <p className="text-xs text-zinc-400 bg-zinc-900 rounded-xl p-3">📝 {notes}</p>}

      {exercises.map((ex, idx) => {
        const isOpen = open === ex.id
        const sets = state.sets[ex.id]
        const prevTop = Math.max(0, ...ex.previous.map((p) => p.weight ?? 0))
        return (
          <div key={ex.id} className={cn("rounded-2xl border overflow-hidden min-w-0", state.completed[ex.id] ? "border-emerald-500/40 bg-emerald-500/5" : isOpen ? "border-orange-500/50 bg-zinc-900" : "border-zinc-800 bg-zinc-900")}>
            <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => setOpen(isOpen ? null : ex.id)}>
              <span className={cn("text-xs font-black w-7", state.completed[ex.id] ? "text-emerald-400" : "text-zinc-500")}>{state.completed[ex.id] ? "✓" : pad(idx + 1)}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{ex.name}</p>
                <p className="text-xs text-zinc-400">{ex.sets} × {ex.reps}{ex.rir ? ` · RIR ${ex.rir}` : ""}{ex.load ? ` · ${ex.load}` : ""}</p>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 space-y-3">
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <button onClick={() => setVideo(ex)} className="flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1.5 font-semibold"><Play className="h-3 w-3" /> Video</button>
                  {prevTop > 0 && <span className="rounded-full bg-zinc-800 px-3 py-1.5">Peso anterior: <b>{fmtKg(prevTop)} kg</b></span>}
                  {ex.tempo && <span className="rounded-full bg-zinc-800 px-3 py-1.5">Tempo {ex.tempo}</span>}
                  {ex.restSec > 0 && <span className="rounded-full bg-zinc-800 px-3 py-1.5">Descanso {ex.restSec}s</span>}
                </div>
                {ex.notes && <p className="text-xs text-orange-300">💡 {ex.notes}</p>}

                <div className="space-y-2">
                  <div className="grid grid-cols-[28px_1fr_1fr_44px] gap-2 text-[10px] uppercase tracking-wider text-zinc-500 px-1">
                    <span>Set</span><span>Kg</span><span>Reps</span><span />
                  </div>
                  {sets.map((s, i) => {
                    const p = ex.previous[i]
                    return (
                      <div key={i} className={cn("grid grid-cols-[28px_1fr_1fr_44px] gap-2 items-center", s.done && "opacity-80")}>
                        <span className="text-sm font-bold text-zinc-400 text-center">{i + 1}</span>
                        <input inputMode="decimal" className="h-11 w-full min-w-0 rounded-xl bg-zinc-800 text-center font-bold outline-none focus:ring-2 focus:ring-orange-500" placeholder={p?.weight ? fmtKg(p.weight) : "kg"} value={s.weight} onChange={(e) => updateSet(ex.id, i, { weight: e.target.value.replace(",", ".") })} />
                        <input inputMode="numeric" className="h-11 w-full min-w-0 rounded-xl bg-zinc-800 text-center font-bold outline-none focus:ring-2 focus:ring-orange-500" placeholder={p?.reps ? String(p.reps) : ex.reps} value={s.reps} onChange={(e) => updateSet(ex.id, i, { reps: e.target.value.replace(/\D/g, "") })} />
                        <button onClick={() => toggleSet(ex, i)} className={cn("h-11 rounded-xl flex items-center justify-center", s.done ? "bg-emerald-500 text-white" : "bg-zinc-800 text-zinc-500")} aria-label="Serie completada">
                          <Check className="h-5 w-5" />
                        </button>
                      </div>
                    )
                  })}
                  <button onClick={() => setState((st) => ({ ...st, sets: { ...st.sets, [ex.id]: [...st.sets[ex.id], { weight: st.sets[ex.id].at(-1)?.weight ?? "", reps: "", done: false }] } }))} className="w-full text-xs text-zinc-400 py-1 flex items-center justify-center gap-1">
                    <Plus className="h-3 w-3" /> Añadir serie
                  </button>
                </div>

                <textarea
                  rows={1}
                  placeholder="¿Alguna molestia o comentario para tu coach?"
                  value={state.notes[ex.exerciseId] ?? ""}
                  onChange={(e) => setState((s) => ({ ...s, notes: { ...s.notes, [ex.exerciseId]: e.target.value } }))}
                  className="w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500 resize-none"
                />
                <button onClick={() => completeExercise(ex, idx)} className="w-full h-12 rounded-xl bg-orange-500 font-bold tracking-wide active:scale-[0.98]">
                  COMPLETAR EJERCICIO
                </button>
              </div>
            )}
          </div>
        )
      })}

      <button onClick={() => (stats.sets ? setFinishing(true) : toast.error("Marca al menos una serie completada"))} className="w-full h-14 rounded-2xl bg-white text-zinc-950 font-black tracking-wide mt-4 active:scale-[0.98]">
        FINALIZAR ENTRENAMIENTO
      </button>
      <button
        onClick={() => {
          if (!confirm("¿Descartar este entrenamiento? Se perderá lo registrado.")) return
          try { localStorage.removeItem(storageKey) } catch {}
          router.push("/app/training")
        }}
        className="w-full text-xs text-zinc-500 py-2"
      >
        Descartar y salir
      </button>

      {rest && (
        <div className="fixed bottom-4 inset-x-4 z-50 max-w-md mx-auto rounded-2xl bg-zinc-800 border border-zinc-700 p-3 flex items-center gap-3 shadow-xl" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
          <Timer className="h-5 w-5 text-orange-400" />
          <div className="flex-1">
            <p className="text-xs text-zinc-400">Descanso</p>
            <div className="h-1.5 bg-zinc-700 rounded-full mt-1 overflow-hidden"><div className="h-full bg-orange-500" style={{ width: `${(restLeft / rest.total) * 100}%` }} /></div>
          </div>
          <p className="font-mono font-black text-xl">{clock(restLeft)}</p>
          <button onClick={() => setRest((r) => (r ? { ...r, until: r.until + 30_000, total: r.total + 30 } : r))} className="text-xs bg-zinc-700 rounded-lg px-2 py-1">+30s</button>
          <button onClick={() => setRest(null)} aria-label="Saltar"><X className="h-5 w-5 text-zinc-400" /></button>
        </div>
      )}

      {video && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-end sm:items-center justify-center" onClick={() => setVideo(null)}>
          <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <p className="font-bold">{video.name}</p>
              <button onClick={() => setVideo(null)}><X className="h-5 w-5" /></button>
            </div>
            {video.videoEmbed ? (
              <iframe src={video.videoEmbed} className="w-full aspect-video rounded-xl" allowFullScreen title={video.name} />
            ) : (
              <a href={video.videoUrl} target="_blank" rel="noreferrer" className="block text-center rounded-xl bg-zinc-800 p-4 text-orange-400 font-semibold">🎥 Abrir video</a>
            )}
            {video.instructions && <p className="text-sm text-zinc-300">{video.instructions}</p>}
            <Link href={`/app/training/exercise/${video.exerciseId}`} className="block text-xs text-zinc-400">Ver ficha completa e historial →</Link>
          </div>
        </div>
      )}

      {finishing && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-end sm:items-center justify-center" onClick={() => setFinishing(false)}>
          <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-black">¿Cómo te sentiste hoy?</p>
            <div className="flex justify-between">
              {["😫", "😕", "😐", "🙂", "🔥"].map((e, i) => (
                <button key={e} onClick={() => setRating(i + 1)} className={cn("h-14 w-14 rounded-2xl text-2xl", rating === i + 1 ? "bg-orange-500" : "bg-zinc-800")}>{e}</button>
              ))}
            </div>
            <textarea rows={3} value={finalNotes} onChange={(e) => setFinalNotes(e.target.value)} placeholder="Comentarios para tu coach (opcional)" className="w-full rounded-xl bg-zinc-800 p-3 text-sm outline-none placeholder:text-zinc-500" />
            <p className="text-xs text-zinc-500">{stats.sets} series · {stats.volume.toLocaleString("es-PE")} kg · {clock(elapsed)}</p>
            <button onClick={finish} disabled={saving} className="w-full h-12 rounded-xl bg-orange-500 font-bold flex items-center justify-center gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} GUARDAR ENTRENAMIENTO
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
