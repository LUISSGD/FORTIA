"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Camera, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ADHERENCE_OPTIONS, ENERGY_OPTIONS, SLEEP_OPTIONS } from "@/lib/coaching/constants"
import { Card, darkInput } from "./ui"
import { compressImage } from "./ProgressActions"

type Existing = { id: string; energy: number; nutritionAdherence: string; sleep: string; stress: number | null; weight: number | null; discomfort: string | null; feelings: string | null; photoCount: number } | null

function Choice<T extends string | number>({ label, options, value, onChange }: { label: string; options: { value: T; label: string; emoji?: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="font-bold mb-2 text-gray-900">{label}</p>
      <div className="space-y-1.5">
        {options.map((o) => (
          <button key={String(o.value)} type="button" onClick={() => onChange(o.value)} className={cn("w-full flex items-center gap-3 rounded-xl px-4 h-11 text-left text-sm", value === o.value ? "bg-orange-500 text-white font-semibold" : "bg-gray-100 text-gray-700")}>
            <span className={cn("h-4 w-4 rounded-full border-2", value === o.value ? "bg-white border-white" : "border-gray-300")} />
            {o.emoji && <span>{o.emoji}</span>}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function CheckInForm({ existing }: { existing: Existing }) {
  const router = useRouter()
  const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null)
  const [adherence, setAdherence] = useState<string | null>(existing?.nutritionAdherence ?? null)
  const [sleep, setSleep] = useState<string | null>(existing?.sleep ?? null)
  const [stress, setStress] = useState<number | null>(existing?.stress ?? null)
  const [weight, setWeight] = useState(existing?.weight ? String(existing.weight) : "")
  const [discomfort, setDiscomfort] = useState(existing?.discomfort ?? "")
  const [feelings, setFeelings] = useState(existing?.feelings ?? "")
  const [saving, setSaving] = useState(false)
  const [checkInId, setCheckInId] = useState(existing?.id ?? null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<string[]>([])
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})

  async function submit() {
    if (!energy || !adherence || !sleep) return toast.error("Responde energía, alimentación y sueño")
    setSaving(true)
    const res = await fetch("/api/app/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ energy, nutritionAdherence: adherence, sleep, stress, weight, discomfort, feelings }),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) return toast.error(d.error ?? "Error")
    setCheckInId(d.id)
    toast.success(existing ? "Check-in actualizado" : "¡Check-in enviado! Tu coach lo revisará pronto 🙌")
    router.refresh()
  }

  async function upload(pose: string, file: File) {
    if (!checkInId) return
    setUploading(pose)
    const fd = new FormData()
    fd.append("pose", pose)
    fd.append("checkInId", checkInId)
    fd.append("file", await compressImage(file))
    const res = await fetch("/api/app/photos", { method: "POST", body: fd })
    setUploading(null)
    if (!res.ok) return toast.error("No se pudo subir la foto")
    setUploaded((u) => [...u, pose])
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-5">
        <Choice label="¿Cómo estuvo tu energía?" options={ENERGY_OPTIONS} value={energy} onChange={setEnergy} />
        <Choice label="¿Cómo cumpliste tu alimentación?" options={ADHERENCE_OPTIONS} value={adherence} onChange={setAdherence} />
        <Choice label="¿Cuánto dormiste en promedio?" options={SLEEP_OPTIONS} value={sleep} onChange={setSleep} />
        <div>
          <p className="font-bold mb-2 text-gray-900">Nivel de estrés <span className="text-xs text-gray-400 font-normal">(opcional)</span></p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setStress(n)} className={cn("flex-1 h-11 rounded-xl font-bold", stress === n ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500")}>{n}</button>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>Tranquilo</span><span>Muy estresado</span></div>
        </div>
        <label className="block space-y-1">
          <span className="font-bold text-gray-900">Peso de esta semana (kg)</span>
          <input inputMode="decimal" className={darkInput} placeholder="Ej: 79.8" value={weight} onChange={(e) => setWeight(e.target.value.replace(",", "."))} />
        </label>
        <label className="block space-y-1">
          <span className="font-bold text-gray-900">¿Tuviste alguna molestia?</span>
          <textarea rows={2} className={cn(darkInput, "h-auto py-2")} placeholder="Ej: el press inclinado me molestó un poco el hombro" value={discomfort} onChange={(e) => setDiscomfort(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="font-bold text-gray-900">¿Cómo te sentiste esta semana?</span>
          <textarea rows={3} className={cn(darkInput, "h-auto py-2")} value={feelings} onChange={(e) => setFeelings(e.target.value)} />
        </label>
        <button onClick={submit} disabled={saving} className="w-full h-12 rounded-xl bg-orange-500 text-white font-bold flex items-center justify-center gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} {existing ? "ACTUALIZAR CHECK-IN" : "ENVIAR CHECK-IN"}
        </button>
      </Card>

      {checkInId && (
        <Card>
          <p className="font-bold mb-1 text-gray-900">📸 Sube tus fotos de la semana</p>
          <p className="text-xs text-gray-400 mb-3">{existing?.photoCount ? `Ya subiste ${existing.photoCount} foto(s).` : "Frente, perfil y espalda."}</p>
          <div className="grid grid-cols-3 gap-2">
            {[["FRENTE", "Frente"], ["PERFIL", "Perfil"], ["ESPALDA", "Espalda"]].map(([k, label]) => (
              <div key={k}>
                <input ref={(el) => { inputs.current[k] = el }} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(k, f); e.target.value = "" }} />
                <button onClick={() => inputs.current[k]?.click()} disabled={!!uploading} className={cn("w-full aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-xs", uploaded.includes(k) ? "border-emerald-500 text-emerald-600" : "border-gray-300 text-gray-400")}>
                  {uploading === k ? <Loader2 className="h-5 w-5 animate-spin" /> : uploaded.includes(k) ? "✓" : <Camera className="h-5 w-5" />}
                  {label}
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
