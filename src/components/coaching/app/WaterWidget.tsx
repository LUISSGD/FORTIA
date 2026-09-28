"use client"

import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { toast } from "sonner"

export default function WaterWidget({ initialMl, targetMl }: { initialMl: number; targetMl: number }) {
  const [ml, setMl] = useState(initialMl)
  const [busy, setBusy] = useState(false)
  const glasses = Math.ceil(targetMl / 250)
  const filled = Math.floor(ml / 250)

  async function change(method: "POST" | "DELETE", amount = 250) {
    if (busy) return
    setBusy(true)
    const prev = ml
    if (method === "POST") setMl((m) => m + amount)
    const res = await fetch("/api/app/water", { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? JSON.stringify({ ml: amount }) : undefined })
    setBusy(false)
    if (!res.ok) {
      setMl(prev)
      return toast.error("No se pudo registrar")
    }
    const data = await res.json()
    setMl(data.total)
    if (method === "POST" && prev < targetMl && data.total >= targetMl) toast.success("💧 ¡Meta de agua cumplida!")
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <p className="text-3xl font-black">{(ml / 1000).toFixed(2)} <span className="text-base font-medium text-zinc-500">/ {(targetMl / 1000).toFixed(2)} L</span></p>
        {ml >= targetMl && <span className="text-xs text-sky-400 font-semibold">✓ Meta cumplida</span>}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {Array.from({ length: Math.max(glasses, filled) }, (_, i) => (
          <div key={i} className={`h-7 w-5 rounded-b-md rounded-t-sm border-2 ${i < filled ? "bg-sky-500 border-sky-500" : "border-zinc-700"}`} />
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => change("DELETE")} disabled={busy || ml === 0} className="h-11 w-11 rounded-xl bg-zinc-800 flex items-center justify-center disabled:opacity-40" aria-label="Deshacer">
          <Minus className="h-4 w-4" />
        </button>
        <button onClick={() => change("POST", 250)} disabled={busy} className="flex-1 h-11 rounded-xl bg-sky-500/15 text-sky-400 font-bold flex items-center justify-center gap-1 active:scale-[0.98]">
          <Plus className="h-4 w-4" /> 250 ml
        </button>
        <button onClick={() => change("POST", 500)} disabled={busy} className="flex-1 h-11 rounded-xl bg-sky-500/15 text-sky-400 font-bold flex items-center justify-center gap-1 active:scale-[0.98]">
          <Plus className="h-4 w-4" /> 500 ml
        </button>
      </div>
    </div>
  )
}
