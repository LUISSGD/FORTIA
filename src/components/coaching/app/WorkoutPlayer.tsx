"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, ChevronDown, Play, Plus, Timer, X, Loader2, Repeat } from "lucide-react"
import { cn } from "@/lib/utils"
import { estimate1RM, fmtKg } from "@/lib/coaching/workout"
import { parseExerciseNotes, splitReps, timedSeconds } from "@/lib/coaching/exercise-format"
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
  // Serie por tiempo en curso ("30 seg", "Mantener 45 segundos")
  const [work, setWork] = useState<{ idx: number; set: number; until: number; total: number } | null>(null)
  const [workLeft, setWorkLeft] = useState(0)
  const loaded = useRef(false)
  const audio = useRef<AudioContext | null>(null)
  const lastTick = useRef(-1)
  // Evita procesar dos veces el final de un mismo temporizador
  const handled = useRef(0)

  // Prescripción legible: bloque, superserie, indicación, RPE y series por tiempo
  const meta = useMemo(() => exercises.map((e) => ({ ...parseExerciseNotes(e.notes), ...splitReps(e.reps), timed: timedSeconds(e.reps) })), [exercises])
  // Superseries: ejercicios seguidos con la misma etiqueta dentro del mismo bloque
  const groups = useMemo(() => exercises.map((_, i) => {
    const same = (k: number) => !!meta[i].superset && meta[k]?.superset === meta[i].superset && meta[k]?.section === meta[i].section
    let a = i
    while (a > 0 && same(a - 1)) a--
    let b = i
    while (b < exercises.length - 1 && same(b + 1)) b++
    return Array.from({ length: b - a + 1 }, (_, k) => a + k)
  }), [exercises, meta])

  /** Sonido de aviso (en iPhone no hay vibración). El audio se habilita con el primer toque del cliente. */
  function unlockAudio() {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!audio.current && Ctx) audio.current = new Ctx()
      if (audio.current?.state === "suspended") void audio.current.resume()
    } catch {}
  }
  function beep(times = 1, freq = 880) {
    const ctx = audio.current
    if (!ctx) return
    for (let k = 0; k < times; k++) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = freq
      o.connect(g)
      g.connect(ctx.destination)
      const t = ctx.currentTime + k * 0.25
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
      o.start(t)
      o.stop(t + 0.2)
    }
  }

  // Pantalla siempre encendida mientras entrena
  useEffect(() => {
    if (summary || !("wakeLock" in navigator)) return
    let lock: WakeLockSentinel | null = null
    const req = () => {
      if (document.visibilityState === "visible") navigator.wakeLock.request("screen").then((l) => { lock = l }).catch(() => {})
    }
    req()
    document.addEventListener("visibilitychange", req)
    return () => {
      document.removeEventListener("visibilitychange", req)
      lock?.release().catch(() => {})
    }
  }, [summary])

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
      const tick = (until: number) => {
        const left = Math.max(0, Math.round((until - Date.now()) / 1000))
        if (left > 0 && left <= 3 && lastTick.current !== left) {
          lastTick.current = left
          beep(1, 660)
        }
        return left
      }
      if (work) {
        const left = tick(work.until)
        setWorkLeft(left)
        if (left === 0 && handled.current !== work.until) {
          handled.current = work.until
          setWork(null)
          beep(3)
          if (navigator.vibrate) navigator.vibrate([200, 100, 200])
          markDone(work.idx, work.set, String(work.total))
        }
      } else if (rest) {
        const left = tick(rest.until)
        setRestLeft(left)
        if (left === 0 && handled.current !== rest.until) {
          handled.current = rest.until
          setRest(null)
          beep(3)
          if (navigator.vibrate) navigator.vibrate([200, 100, 200])
        }
      }
    }, 250)
    return () => clearInterval(t)
  }, [state.startedAt, rest, work])

  const updateSet = useCallback((exId: string, i: number, patch: Partial<SetState>) => {
    setState((s) => ({ ...s, sets: { ...s.sets, [exId]: s.sets[exId].map((x, k) => (k === i ? { ...x, ...patch } : x)) } }))
  }, [])

  /** Valores de una serie que el cliente no escribió: lo de la vez anterior o el objetivo de la rutina. */
  function setDefaults(ex: Ex, i: number, set: SetState) {
    const prev = ex.previous[i] ?? ex.previous.at(-1)
    // "12 a 10 RPE@8-9" → 12 (se ignora el RPE)
    const target = ex.reps.replace(/RPE.*$/i, "").match(/\d+/)?.[0] ?? ""
    return {
      reps: set.reps || (prev?.reps ? String(prev.reps) : "") || target,
      weight: set.weight || (prev?.weight ? String(prev.weight) : ""),
    }
  }

  /** Marca la serie hecha y decide qué sigue: en superserie pasa al siguiente ejercicio sin descanso. */
  function markDone(idx: number, i: number, reps: string) {
    const ex = exercises[idx]
    updateSet(ex.id, i, { done: true, reps })
    const g = groups[idx]
    const pos = g.indexOf(idx)
    if (g.length > 1 && pos < g.length - 1) {
      setOpen(exercises[g[pos + 1]].id)
      return
    }
    if (g.length > 1) {
      // Fin de la vuelta: descanso y, si quedan vueltas, de nuevo al primero de la superserie
      const first = exercises[g[0]]
      setOpen(i + 1 < Math.max(first.sets, 1) ? first.id : exercises[g[g.length - 1] + 1]?.id ?? null)
    }
    const restSec = g.length > 1 ? Math.max(...g.map((k) => exercises[k].restSec)) : ex.restSec
    if (restSec > 0) {
      lastTick.current = -1
      setRest({ until: Date.now() + restSec * 1000, total: restSec })
      setRestLeft(restSec)
    }
  }

  function toggleSet(ex: Ex, idx: number, i: number) {
    unlockAudio()
    const set = state.sets[ex.id][i]
    if (set.done) return updateSet(ex.id, i, { done: false })
    // Serie por tiempo en curso: tocar de nuevo la termina antes
    if (work && work.idx === idx && work.set === i) {
      setWork(null)
      return markDone(idx, i, String(Math.max(1, work.total - workLeft)))
    }
    const timed = meta[idx].timed
    if (timed && !set.reps) {
      lastTick.current = -1
      setRest(null)
      setWork({ idx, set: i, until: Date.now() + timed * 1000, total: timed })
      setWorkLeft(timed)
      return
    }
    const { reps } = setDefaults(ex, i, set)
    if (!reps) return toast.error("Indica las repeticiones")
    markDone(idx, i, reps)
  }

  function completeExercise(ex: Ex, idx: number) {
    if (work?.idx === idx) setWork(null)
    const sets = state.sets[ex.id] ?? []
    // Si no marcó ninguna serie, se dan por hechas todas con los valores que ve en pantalla
    const fillAll = !sets.some((s) => s.done)
    setState((s) => ({
      ...s,
      sets: fillAll ? { ...s.sets, [ex.id]: sets.map((x, i) => ({ ...x, ...setDefaults(ex, i, x), done: true })) } : s.sets,
      completed: { ...s.completed, [ex.id]: true },
    }))
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
          <h1 className="text-2xl font-black text-gray-900">ENTRENAMIENTO COMPLETADO</h1>
          <p className="text-gray-500">{title}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 w-full">
          {[["Duración", `${summary.duration} min`], ["Ejercicios", summary.exercises], ["Volumen", `${summary.volume.toLocaleString("es-PE")} kg`]].map(([l, v]) => (
            <div key={l as string} className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-[11px] text-gray-400 uppercase tracking-wider">{l}</p>
              <p className="text-lg font-black text-gray-900">{v}</p>
            </div>
          ))}
        </div>
        {summary.prs.length > 0 && (
          <div className="rounded-2xl bg-orange-50 border border-orange-200 p-4 w-full">
            <p className="font-bold text-orange-600">🏆 ¡Nuevo récord personal!</p>
            <p className="text-sm text-gray-600">{summary.prs.join(", ")}</p>
          </div>
        )}
        <Link href="/app" className="w-full h-12 rounded-xl bg-orange-500 text-white font-bold flex items-center justify-center">VOLVER AL INICIO</Link>
        <Link href="/app/chat" className="text-sm text-gray-400">Contarle a tu coach cómo te fue →</Link>
      </div>
    )
  }

  const doneCount = exercises.filter((e) => state.completed[e.id]).length

  return (
    <div className="space-y-3 -mt-2">
      <div className="sticky top-14 z-30 -mx-4 px-4 py-3 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-orange-500 font-bold">🔥 Entrenamiento de hoy</p>
            <p className="font-black truncate text-gray-900">{title} <span className="text-gray-400 font-medium text-sm">· {subtitle}</span></p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono font-bold text-lg text-gray-900">{clock(elapsed)}</p>
            <p className="text-[10px] text-gray-400">{doneCount}/{exercises.length} · {stats.volume.toLocaleString("es-PE")} kg</p>
          </div>
        </div>
        <div className="h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-orange-500 transition-all" style={{ width: `${(doneCount / Math.max(1, exercises.length)) * 100}%` }} />
        </div>
      </div>

      {notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">📝 {notes}</p>}

      {exercises.map((ex, idx) => {
        const isOpen = open === ex.id
        const sets = state.sets[ex.id]
        const prevTop = Math.max(0, ...ex.previous.map((p) => p.weight ?? 0))
        const m = meta[idx]
        const g = groups[idx]
        const inSuperset = g.length > 1
        const newSection = m.section && (idx === 0 || m.section !== meta[idx - 1].section)
        return (
          <Fragment key={ex.id}>
          {newSection && <p className="pt-2 text-[11px] font-black uppercase tracking-widest text-gray-500">{m.section}</p>}
          <div className={cn("rounded-2xl border overflow-hidden min-w-0", inSuperset && "border-l-4 border-l-violet-400", state.completed[ex.id] ? "border-emerald-200 bg-emerald-50" : isOpen ? "border-orange-200 bg-white" : "border-gray-200 bg-white")}>
            <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => setOpen(isOpen ? null : ex.id)}>
              <span className={cn("text-xs font-black w-7", state.completed[ex.id] ? "text-emerald-600" : "text-gray-400")}>{state.completed[ex.id] ? "✓" : pad(idx + 1)}</span>
              <div className="flex-1 min-w-0">
                {inSuperset && <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">{m.superset} · {g.indexOf(idx) + 1}/{g.length}</p>}
                <p className="font-bold text-gray-900 truncate">{ex.name}</p>
                <p className="text-xs text-gray-400">{ex.sets} × {m.reps}{m.rpe ? ` · RPE ${m.rpe}` : ""}{ex.rir ? ` · RIR ${ex.rir}` : ""}{ex.load ? ` · ${ex.load}` : ""}</p>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-gray-400 transition", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 space-y-3">
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <button onClick={() => setVideo(ex)} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 font-semibold text-gray-700"><Play className="h-3 w-3" /> Video</button>
                  {prevTop > 0 && <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700">Peso anterior: <b>{fmtKg(prevTop)} kg</b></span>}
                  {m.rpe && <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700" title="Esfuerzo percibido de 1 a 10">RPE {m.rpe} · esfuerzo {m.rpe}/10</span>}
                  {m.timed && <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700">⏱ {m.timed}s por serie</span>}
                  {ex.tempo && <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700">Tempo {ex.tempo}</span>}
                  {ex.restSec > 0 && !inSuperset && <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700">Descanso {ex.restSec}s</span>}
                </div>
                {inSuperset && (
                  <p className="text-xs text-violet-700 bg-violet-50 rounded-xl px-3 py-2 flex gap-2">
                    <Repeat className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{m.superset}: haz una serie de cada ejercicio seguido ({g.map((k) => exercises[k].name).join(" + ")}) y descansa al terminar la vuelta.</span>
                  </p>
                )}
                {m.tip && <p className="text-xs text-orange-500">💡 {m.tip}</p>}

                <div className="space-y-2">
                  <div className="grid grid-cols-[28px_1fr_1fr_44px] gap-2 text-[10px] uppercase tracking-wider text-gray-400 px-1">
                    <span>Set</span><span>Kg</span><span>{m.timed ? "Seg" : "Reps"}</span><span />
                  </div>
                  {sets.map((s, i) => {
                    const p = ex.previous[i]
                    const running = work?.idx === idx && work.set === i
                    return (
                      <div key={i} className={cn("grid grid-cols-[28px_1fr_1fr_44px] gap-2 items-center", s.done && "opacity-80")}>
                        <span className="text-sm font-bold text-gray-400 text-center">{i + 1}</span>
                        <input inputMode="decimal" className="h-11 w-full min-w-0 rounded-xl bg-gray-100 text-center font-bold text-gray-900 outline-none focus:ring-2 focus:ring-orange-500" placeholder={p?.weight ? fmtKg(p.weight) : "kg"} value={s.weight} onChange={(e) => updateSet(ex.id, i, { weight: e.target.value.replace(",", ".") })} />
                        <input inputMode="numeric" className="h-11 w-full min-w-0 rounded-xl bg-gray-100 text-center font-bold text-gray-900 outline-none focus:ring-2 focus:ring-orange-500" placeholder={p?.reps ? String(p.reps) : m.timed ? String(m.timed) : m.reps} value={s.reps} onChange={(e) => updateSet(ex.id, i, { reps: e.target.value.replace(/\D/g, "") })} />
                        <button onClick={() => toggleSet(ex, idx, i)} className={cn("h-11 rounded-xl flex items-center justify-center font-mono font-bold text-sm", s.done ? "bg-emerald-500 text-white" : running ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-400")} aria-label={m.timed && !s.done ? "Iniciar serie por tiempo" : "Serie completada"}>
                          {running ? workLeft : m.timed && !s.done && !s.reps ? <Timer className="h-5 w-5" /> : <Check className="h-5 w-5" />}
                        </button>
                      </div>
                    )
                  })}
                  <button onClick={() => setState((st) => ({ ...st, sets: { ...st.sets, [ex.id]: [...st.sets[ex.id], { weight: st.sets[ex.id].at(-1)?.weight ?? "", reps: "", done: false }] } }))} className="w-full text-xs text-gray-400 py-1 flex items-center justify-center gap-1">
                    <Plus className="h-3 w-3" /> Añadir serie
                  </button>
                </div>

                <textarea
                  rows={1}
                  placeholder="¿Alguna molestia o comentario para tu coach?"
                  value={state.notes[ex.exerciseId] ?? ""}
                  onChange={(e) => setState((s) => ({ ...s, notes: { ...s.notes, [ex.exerciseId]: e.target.value } }))}
                  className="w-full rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-orange-400 resize-none"
                />
                <button onClick={() => completeExercise(ex, idx)} className="w-full h-12 rounded-xl bg-orange-500 text-white font-bold tracking-wide active:scale-[0.98]">
                  COMPLETAR EJERCICIO
                </button>
              </div>
            )}
          </div>
          </Fragment>
        )
      })}

      <button onClick={() => (stats.sets ? setFinishing(true) : toast.error("Marca al menos una serie completada"))} className="w-full h-14 rounded-2xl bg-gray-900 text-white font-black tracking-wide mt-4 active:scale-[0.98]">
        FINALIZAR ENTRENAMIENTO
      </button>
      <button
        onClick={() => {
          if (!confirm("¿Descartar este entrenamiento? Se perderá lo registrado.")) return
          try { localStorage.removeItem(storageKey) } catch {}
          router.push("/app/training")
        }}
        className="w-full text-xs text-gray-400 py-2"
      >
        Descartar y salir
      </button>

      {work && (
        <div className="fixed bottom-4 inset-x-4 z-50 max-w-md mx-auto rounded-2xl bg-orange-500 text-white p-3 flex items-center gap-3 shadow-xl" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
          <Timer className="h-5 w-5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{exercises[work.idx].name} · serie {work.set + 1}</p>
            <div className="h-1.5 bg-white/30 rounded-full mt-1 overflow-hidden"><div className="h-full bg-white" style={{ width: `${(workLeft / work.total) * 100}%` }} /></div>
          </div>
          <p className="font-mono font-black text-2xl">{clock(workLeft)}</p>
          <button onClick={() => toggleSet(exercises[work.idx], work.idx, work.set)} className="text-xs font-bold bg-white/20 rounded-lg px-2 py-1">Listo</button>
        </div>
      )}

      {rest && !work && (
        <div className="fixed bottom-4 inset-x-4 z-50 max-w-md mx-auto rounded-2xl bg-white border border-gray-200 p-3 flex items-center gap-3 shadow-xl" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
          <Timer className="h-5 w-5 text-orange-500" />
          <div className="flex-1">
            <p className="text-xs text-gray-500">Descanso</p>
            <div className="h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden"><div className="h-full bg-orange-500" style={{ width: `${(restLeft / rest.total) * 100}%` }} /></div>
          </div>
          <p className="font-mono font-black text-xl text-gray-900">{clock(restLeft)}</p>
          <button onClick={() => setRest((r) => (r ? { ...r, until: r.until + 30_000, total: r.total + 30 } : r))} className="text-xs bg-gray-100 rounded-lg px-2 py-1 text-gray-700">+30s</button>
          <button onClick={() => setRest(null)} aria-label="Saltar"><X className="h-5 w-5 text-gray-400" /></button>
        </div>
      )}

      {video && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setVideo(null)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <p className="font-bold text-gray-900">{video.name}</p>
              <button onClick={() => setVideo(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            {video.videoEmbed ? (
              <iframe src={video.videoEmbed} className="w-full aspect-video rounded-xl" allowFullScreen title={video.name} />
            ) : (
              <a href={video.videoUrl} target="_blank" rel="noreferrer" className="block text-center rounded-xl bg-gray-50 p-4 text-orange-500 font-semibold">🎥 Abrir video</a>
            )}
            {video.instructions && <p className="text-sm text-gray-700">{video.instructions}</p>}
            <Link href={`/app/training/exercise/${video.exerciseId}`} className="block text-xs text-gray-400">Ver ficha completa e historial →</Link>
          </div>
        </div>
      )}

      {finishing && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setFinishing(false)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-black text-gray-900">¿Cómo te sentiste hoy?</p>
            <div className="flex justify-between">
              {["😫", "😕", "😐", "🙂", "🔥"].map((e, i) => (
                <button key={e} onClick={() => setRating(i + 1)} className={cn("h-14 w-14 rounded-2xl text-2xl", rating === i + 1 ? "bg-orange-500" : "bg-gray-100")}>{e}</button>
              ))}
            </div>
            <textarea rows={3} value={finalNotes} onChange={(e) => setFinalNotes(e.target.value)} placeholder="Comentarios para tu coach (opcional)" className="w-full rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm text-gray-900 outline-none placeholder:text-gray-400" />
            <p className="text-xs text-gray-400">{stats.sets} series · {stats.volume.toLocaleString("es-PE")} kg · {clock(elapsed)}</p>
            <button onClick={finish} disabled={saving} className="w-full h-12 rounded-xl bg-orange-500 text-white font-bold flex items-center justify-center gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} GUARDAR ENTRENAMIENTO
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
