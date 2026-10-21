"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/** Marca la asistencia de una clase EP desde la pantalla Hoy (o la reprograma a otra fecha y hora). */
export default function AttendanceButtons({ sessionId, attended, time }: { sessionId: string; attended: boolean | null; time?: string | null }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [reprogramming, setReprogramming] = useState(false)
  const [date, setDate] = useState("")
  const [newTime, setNewTime] = useState(time ?? "")

  async function send(body: object, ok: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/trainer/sessions/${sessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo guardar")
      toast.success(ok)
      setReprogramming(false)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const mark = (value: boolean | null) =>
    send({ attended: value }, value === true ? "Asistencia registrada ✅" : value === false ? "Inasistencia registrada" : "Marcado deshecho")

  if (attended !== null) {
    return (
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className={cn("font-semibold", attended ? "text-emerald-700" : "text-red-600")}>{attended ? "✅ Asistió" : "❌ No asistió"}</span>
        <button disabled={saving} onClick={() => mark(null)} className="text-xs text-gray-400 underline disabled:opacity-40">Deshacer</button>
      </div>
    )
  }
  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <button disabled={saving} onClick={() => mark(true)} className="h-10 rounded-xl bg-emerald-500 text-white text-sm font-bold disabled:opacity-40">✅ Asistió</button>
        <button disabled={saving} onClick={() => mark(false)} className="h-10 rounded-xl border border-red-200 bg-white text-red-600 text-sm font-semibold disabled:opacity-40">No vino</button>
        <button
          disabled={saving}
          onClick={() => setReprogramming((v) => !v)}
          className={cn("h-10 rounded-xl border text-sm font-semibold disabled:opacity-40", reprogramming ? "border-sky-500 bg-sky-500 text-white" : "border-sky-200 bg-white text-sky-700")}
        >
          🔁 Reprogramó
        </button>
      </div>
      {reprogramming && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-sky-800">Nueva fecha y hora de la clase</p>
          <div className="flex gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm" />
            <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm" />
          </div>
          <button
            disabled={saving || !date}
            onClick={() => send({ scheduledDate: date, startTime: newTime, reprogram: true }, "Clase reprogramada 🔁")}
            className="w-full h-10 rounded-xl bg-sky-600 text-white text-sm font-bold disabled:opacity-40"
          >
            {saving ? "Guardando…" : "Guardar reprogramación"}
          </button>
        </div>
      )}
    </div>
  )
}
