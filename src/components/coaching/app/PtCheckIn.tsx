"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import type { PersonalTraining } from "@/lib/coaching/personal-training"
import { request } from "./request"
import { Bar } from "./ui"

export default function PtCheckIn({ initial, compact = false }: { initial: PersonalTraining; compact?: boolean }) {
  const router = useRouter()
  const [pt, setPt] = useState(initial)
  const [busy, setBusy] = useState(false)

  async function send(method: "POST" | "DELETE") {
    if (method === "DELETE" && !confirm("¿Quitar la clase que registraste hoy?")) return
    setBusy(true)
    try {
      const r = await request<{ plan: PersonalTraining | null; remaining?: number }>("/api/app/personal", { method })
      if (r.plan) setPt(r.plan)
      if (method === "POST") toast.success(r.remaining === 0 ? "¡Clase registrada! Completaste tu paquete 🎉" : `¡Clase registrada! 💪 Te quedan ${r.remaining}`)
      else toast.success("Registro quitado")
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const paused = pt.status === "PAUSED"

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <p className="text-3xl font-black text-gray-900">
          {pt.remaining} <span className="text-base font-medium text-gray-400">clase{pt.remaining === 1 ? "" : "s"} disponible{pt.remaining === 1 ? "" : "s"}</span>
        </p>
        <p className="text-xs text-gray-400 pb-1">{pt.used}/{pt.total} usadas</p>
      </div>
      <Bar value={pt.used} max={pt.total} />

      {pt.todaySession ? (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between gap-2">
          <p className="font-bold text-emerald-600 text-sm">✅ Clase de hoy registrada</p>
          {pt.canUndoToday && (
            <button onClick={() => send("DELETE")} disabled={busy} className="text-[11px] text-gray-400 underline">
              Deshacer
            </button>
          )}
        </div>
      ) : paused ? (
        <p className="text-sm text-amber-600">Tu paquete está en pausa. Habla con tu coach para reactivarlo.</p>
      ) : pt.remaining === 0 ? (
        <p className="text-sm text-amber-600">Ya usaste todas tus clases. Habla con tu coach para renovar tu paquete.</p>
      ) : (
        <button
          onClick={() => send("POST")}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-orange-500 text-white font-bold tracking-wide active:scale-[0.98] transition disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} FUI A MI CLASE HOY
        </button>
      )}

      {compact && (
        <Link href="/app/personal" className="block text-center text-xs text-gray-400">Ver historial y horario →</Link>
      )}
    </div>
  )
}
