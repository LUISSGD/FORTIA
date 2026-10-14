"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { TRAINERS, trainerStyle } from "@/lib/trainers"

/** Selector del entrenador de las clases personalizadas; guarda al elegir. */
export default function TrainerPicker({ clientId, trainer }: { clientId: string; trainer: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(trainer ?? "")
  const [saving, setSaving] = useState(false)

  async function save(next: string) {
    const prev = value
    setValue(next)
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/trainer`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainer: next || null }) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo guardar")
      toast.success(next ? `Entrenador: ${next}` : "Entrenador quitado")
      router.refresh()
    } catch (e) {
      setValue(prev)
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const legacy = value && !TRAINERS.some((t) => t.name === value)
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", trainerStyle(value).dot)} />
      <select value={value} disabled={saving} onChange={(e) => save(e.target.value)} className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-sm disabled:opacity-50">
        <option value="">Sin entrenador</option>
        {TRAINERS.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
        {legacy && <option value={value}>{value} (anterior)</option>}
      </select>
    </span>
  )
}
