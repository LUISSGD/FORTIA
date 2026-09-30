"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Search, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { darkInput } from "./ui"
import { request } from "./request"

type Macros = { kcal: number; protein: number; carbs: number; fat: number }
type Option = { id: string; label: string; notes: string | null; macros: Macros; items: { name: string; qty: string }[] }
type Meal = { id: string; name: string; time: string | null; options: Option[] }
type Log = { id: string; mealId: string | null; optionId: string | null; name: string; status: string; kcal: number; protein: number }
type Food = { id: string; name: string; kcal: number; protein: number; carbs: number; fat: number; unitName: string | null; unitGrams: number | null }

const EMOJI: Record<string, string> = { desayuno: "🍳", almuerzo: "🍗", cena: "🍝", snack: "🥗", merienda: "🥪", "pre": "⚡", "post": "🥤" }
const emojiFor = (name: string) => Object.entries(EMOJI).find(([k]) => name.toLowerCase().includes(k))?.[1] ?? "🍽️"

export default function MealsDay({ date, meals, logs }: { date: string; meals: Meal[]; logs: Log[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(meals.map((m) => [m.id, logs.find((l) => l.mealId === m.id)?.optionId ?? m.options[0]?.id ?? ""]))
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  async function call(key: string, method: string, url: string, body?: unknown) {
    setBusy(key)
    try {
      await request(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined })
      router.refresh()
      return true
    } catch (e) {
      toast.error((e as Error).message)
      return false
    } finally {
      setBusy(null)
    }
  }

  const extras = logs.filter((l) => !l.mealId)
  const doneCount = meals.filter((m) => logs.some((l) => l.mealId === m.id && l.status === "DONE")).length

  return (
    <div className="space-y-3">
      {meals.length > 0 && (
        <p className="text-xs font-bold tracking-widest uppercase text-gray-500">Comidas · {doneCount}/{meals.length} completadas</p>
      )}
      {meals.map((meal) => {
        const log = logs.find((l) => l.mealId === meal.id)
        const optId = selected[meal.id]
        const option = meal.options.find((o) => o.id === optId) ?? meal.options[0]
        return (
          <div key={meal.id} className={cn("rounded-2xl border p-4", log?.status === "DONE" ? "bg-emerald-50 border-emerald-200" : log?.status === "SKIPPED" ? "bg-red-50 border-red-200" : "bg-white border-gray-200")}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-gray-900">{emojiFor(meal.name)} {meal.name} {meal.time && <span className="text-xs text-gray-400 font-normal">{meal.time}</span>}</p>
              <span className={cn("text-xs font-semibold", log?.status === "DONE" ? "text-emerald-600" : log?.status === "SKIPPED" ? "text-red-500" : "text-gray-400")}>
                {log?.status === "DONE" ? "✅ Completado" : log?.status === "SKIPPED" ? "⏭️ Omitida" : "❌ Pendiente"}
              </span>
            </div>
            {meal.options.length > 1 && (
              <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
                {meal.options.map((o) => (
                  <button key={o.id} onClick={() => setSelected((s) => ({ ...s, [meal.id]: o.id }))} className={cn("shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold", o.id === option?.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500")}>
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            {option && (
              <>
                <ul className="space-y-1 mb-2">
                  {option.items.map((it, i) => (
                    <li key={i} className="text-sm flex justify-between gap-3 text-gray-900"><span>{it.name}</span><span className="text-gray-400 text-xs shrink-0">{it.qty}</span></li>
                  ))}
                </ul>
                {option.notes && <p className="text-xs text-gray-500 mb-2">💡 {option.notes}</p>}
                <p className="text-xs text-gray-500 mb-3">
                  <b className="text-gray-900">{option.macros.kcal} kcal</b> · P {option.macros.protein} g · C {option.macros.carbs} g · G {option.macros.fat} g
                </p>
              </>
            )}
            {log ? (
              <div className="flex gap-2">
                {log.status === "DONE" && log.optionId !== option?.id && (
                  <button disabled={!!busy} onClick={() => call(meal.id, "POST", "/api/app/meals", { mealId: meal.id, optionId: option?.id, status: "DONE", date })} className="flex-1 h-10 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700">Cambiar a {option?.label}</button>
                )}
                <button disabled={!!busy} onClick={() => call(meal.id, "DELETE", `/api/app/meals?id=${log.id}`)} className="flex-1 h-10 rounded-xl bg-gray-100 text-sm text-gray-500">Deshacer</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button disabled={!!busy || !option} onClick={() => call(meal.id, "POST", "/api/app/meals", { mealId: meal.id, optionId: option?.id, status: "DONE", date })} className="flex-1 h-11 rounded-xl bg-orange-500 text-white font-bold text-sm active:scale-[0.98]">
                  ✓ Comí esto
                </button>
                <button disabled={!!busy} onClick={() => call(meal.id, "POST", "/api/app/meals", { mealId: meal.id, status: "SKIPPED", date })} className="h-11 px-4 rounded-xl bg-gray-100 text-sm text-gray-500">Omitir</button>
              </div>
            )}
          </div>
        )
      })}

      <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-bold text-gray-900">➕ Extras / fuera del plan</p>
          <button onClick={() => setAdding(true)} className="text-xs font-bold text-orange-500 flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Añadir</button>
        </div>
        {extras.length === 0 ? (
          <p className="text-xs text-gray-400">¿Comiste algo que no estaba en el plan? Regístralo con honestidad, así tu coach puede ajustar.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {extras.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-2 text-sm text-gray-900">
                <span>{l.name}</span>
                <span className="flex items-center gap-2 text-xs text-gray-400">
                  {l.kcal} kcal
                  <button onClick={() => call(l.id, "DELETE", `/api/app/meals?id=${l.id}`)}><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {adding && <AddFood date={date} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); router.refresh() }} />}
    </div>
  )
}

function AddFood({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: () => void }) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<Food[]>([])
  const [food, setFood] = useState<Food | null>(null)
  const [grams, setGrams] = useState("100")
  const [free, setFree] = useState({ name: "", kcal: "", protein: "" })
  const [mode, setMode] = useState<"search" | "free">("search")
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  function search(v: string) {
    setQ(v)
    if (timer) clearTimeout(timer)
    setTimer(setTimeout(async () => {
      if (v.trim().length < 2) return setResults([])
      const res = await fetch(`/api/app/foods?q=${encodeURIComponent(v)}`)
      if (res.ok) setResults(await res.json())
    }, 250))
  }

  async function save() {
    const body = mode === "search" ? { foodId: food?.id, grams, date } : { ...free, date }
    const res = await fetch("/api/app/meals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const d = await res.json()
    if (!res.ok) return toast.error(d.error ?? "Error")
    toast.success("Registrado")
    onSaved()
  }

  const kcal = food ? Math.round((food.kcal * (Number(grams) || 0)) / 100) : 0

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <p className="font-black text-lg text-gray-900">Registrar comida</p>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMode("search")} className={cn("flex-1 h-9 rounded-lg text-xs font-semibold", mode === "search" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600")}>Buscar alimento</button>
          <button onClick={() => setMode("free")} className={cn("flex-1 h-9 rounded-lg text-xs font-semibold", mode === "free" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600")}>Entrada libre</button>
        </div>
        {mode === "search" ? (
          food ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-gray-100 p-3 flex justify-between items-center">
                <span className="font-semibold text-gray-900">{food.name}</span>
                <button onClick={() => setFood(null)} className="text-xs text-gray-400">Cambiar</button>
              </div>
              <div className="flex gap-2 items-center">
                <input inputMode="decimal" className={darkInput} value={grams} onChange={(e) => setGrams(e.target.value)} />
                <span className="text-sm text-gray-400">g</span>
              </div>
              {food.unitName && food.unitGrams && (
                <div className="flex gap-2">
                  {[1, 2, 3].map((n) => (
                    <button key={n} onClick={() => setGrams(String(n * food.unitGrams!))} className="flex-1 h-9 rounded-lg bg-gray-100 text-xs text-gray-700">{n} {food.unitName}</button>
                  ))}
                </div>
              )}
              <p className="text-sm text-gray-700"><b>{kcal} kcal</b> · P {Math.round((food.protein * (Number(grams) || 0)) / 100)} g</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3.5 text-gray-400" />
                <input autoFocus className={cn(darkInput, "pl-9")} placeholder="Ej: pan, palta, yogur…" value={q} onChange={(e) => search(e.target.value)} />
              </div>
              <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {results.map((f) => (
                  <li key={f.id}>
                    <button className="w-full text-left py-2.5" onClick={() => { setFood(f); setGrams(String(f.unitGrams ?? 100)) }}>
                      <p className="text-sm font-semibold text-gray-900">{f.name}</p>
                      <p className="text-xs text-gray-400">{Math.round(f.kcal)} kcal / 100 g</p>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : (
          <div className="space-y-2">
            <input className={darkInput} placeholder="¿Qué comiste?" value={free.name} onChange={(e) => setFree({ ...free, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input inputMode="numeric" className={darkInput} placeholder="Kcal aprox." value={free.kcal} onChange={(e) => setFree({ ...free, kcal: e.target.value })} />
              <input inputMode="numeric" className={darkInput} placeholder="Proteína (g)" value={free.protein} onChange={(e) => setFree({ ...free, protein: e.target.value })} />
            </div>
          </div>
        )}
        <button onClick={save} disabled={mode === "search" ? !food : !free.name} className="w-full h-12 rounded-xl bg-orange-500 text-white font-bold disabled:opacity-40">Guardar</button>
      </div>
    </div>
  )
}
