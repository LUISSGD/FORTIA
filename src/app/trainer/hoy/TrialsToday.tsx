"use client"

import { useState } from "react"
import { Phone, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { trainerStyle } from "@/lib/trainers"
import { TrialModals } from "@/components/coaching/trials/TrialModals"
import type { Trial } from "@/lib/coaching/trials"

/** Clases de prueba de hoy en la pantalla Hoy del entrenador, con opción de agendar una nueva. */
export default function TrialsToday({ trials, today }: { trials: Trial[]; today: string }) {
  const [form, setForm] = useState<{ date?: string; trial?: Trial } | null>(null)
  const [detail, setDetail] = useState<Trial | null>(null)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Clases de prueba</h2>
        <button onClick={() => setForm({ date: today })} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">+ Agendar</button>
      </div>
      {trials.length === 0 ? (
        <p className="text-sm text-gray-400">Sin clases de prueba hoy.</p>
      ) : (
        trials.map((t) => (
          <button key={t.id} onClick={() => setDetail(t)} className={cn("w-full text-left rounded-2xl border-2 border-dashed p-4", t.status === "ATTENDED" ? "border-emerald-300 bg-emerald-50/40" : t.status === "NO_SHOW" ? "border-red-200 bg-red-50/40" : "border-amber-300 bg-amber-50/50")}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-lg font-black text-gray-900 flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-amber-600" />{t.startTime}</p>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", trainerStyle(t.trainer).pill)}>{t.trainer ?? "Sin entrenador"}</span>
            </div>
            <p className="font-semibold text-gray-900">{[t.firstName, t.lastName].filter(Boolean).join(" ")}</p>
            {t.goal && <p className="text-xs text-gray-600">Objetivo: {t.goal}</p>}
            {t.phone && <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" />{t.phone}</p>}
            <p className="text-xs mt-1 font-semibold text-gray-500">{t.status === "ATTENDED" ? "✅ Asistió" : t.status === "NO_SHOW" ? "❌ No vino" : "Toca para marcar asistencia"}</p>
          </button>
        ))
      )}
      <TrialModals
        form={form}
        onCloseForm={() => setForm(null)}
        detail={detail}
        onCloseDetail={() => setDetail(null)}
        onEdit={(t) => { setDetail(null); setForm({ trial: t }) }}
        canConvert={false}
      />
    </section>
  )
}
