"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/** Marca la asistencia de una clase EP desde la pantalla Hoy. */
export default function AttendanceButtons({ sessionId, attended }: { sessionId: string; attended: boolean | null }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function mark(value: boolean | null) {
    setSaving(true)
    try {
      const res = await fetch(`/api/trainer/sessions/${sessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attended: value }) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo guardar")
      toast.success(value === true ? "Asistencia registrada ✅" : value === false ? "Inasistencia registrada" : "Marcado deshecho")
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (attended !== null) {
    return (
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className={cn("font-semibold", attended ? "text-emerald-700" : "text-red-600")}>{attended ? "✅ Asistió" : "❌ No asistió"}</span>
        <button disabled={saving} onClick={() => mark(null)} className="text-xs text-gray-400 underline disabled:opacity-40">Deshacer</button>
      </div>
    )
  }
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button disabled={saving} onClick={() => mark(true)} className="h-10 rounded-xl bg-emerald-500 text-white text-sm font-bold disabled:opacity-40">✅ Asistió</button>
      <button disabled={saving} onClick={() => mark(false)} className="h-10 rounded-xl border border-red-200 bg-white text-red-600 text-sm font-semibold disabled:opacity-40">No vino</button>
    </div>
  )
}
