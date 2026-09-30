"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Camera, Loader2, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import PhotoCompare from "@/components/coaching/PhotoCompare"
import { Card, SectionTitle, darkInput } from "./ui"

type Photo = { id: string; date: string; pose: string; url: string }

export async function compressImage(file: File, max = 1400): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82))
    return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file
  } catch {
    return file
  }
}

export default function ProgressActions({ photos }: { photos: Photo[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ weight: "", waist: "", chest: "", arms: "", hips: "", legs: "", bodyFat: "" })
  const [uploading, setUploading] = useState<string | null>(null)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})

  async function saveMeasure() {
    const res = await fetch("/api/app/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) })
    const d = await res.json()
    if (!res.ok) return toast.error(d.error ?? "Error")
    toast.success("Medidas guardadas")
    setOpen(false)
    setF({ weight: "", waist: "", chest: "", arms: "", hips: "", legs: "", bodyFat: "" })
    router.refresh()
  }

  async function upload(pose: string, file: File) {
    setUploading(pose)
    const fd = new FormData()
    fd.append("pose", pose)
    fd.append("file", await compressImage(file))
    const res = await fetch("/api/app/photos", { method: "POST", body: fd })
    setUploading(null)
    const d = await res.json()
    if (!res.ok) return toast.error(d.error ?? "No se pudo subir")
    toast.success("Foto subida 📸")
    router.refresh()
  }

  async function removePhoto(id: string) {
    if (!confirm("¿Eliminar esta foto?")) return
    await fetch(`/api/app/photos?id=${id}`, { method: "DELETE" })
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="w-full h-12 rounded-xl bg-orange-500 text-white font-bold flex items-center justify-center gap-2 active:scale-[0.98]">
        <Plus className="h-4 w-4" /> Registrar peso y medidas
      </button>

      <Card>
        <SectionTitle emoji="📸">Fotos de progreso</SectionTitle>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[["FRENTE", "Frente"], ["PERFIL", "Perfil"], ["ESPALDA", "Espalda"]].map(([k, label]) => (
            <div key={k}>
              <input ref={(el) => { inputs.current[k] = el }} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(k, file); e.target.value = "" }} />
              <button onClick={() => inputs.current[k]?.click()} disabled={!!uploading} className="w-full aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 active:bg-gray-50">
                {uploading === k ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                <span className="text-xs">{label}</span>
              </button>
            </div>
          ))}
        </div>
        <PhotoCompare photos={photos} onDelete={removePhoto} />
        <p className="text-[11px] text-gray-400 mt-3">Consejo: misma luz, misma hora (en ayunas) y misma distancia cada vez. Solo tú y tu coach ven tus fotos.</p>
      </Card>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <p className="font-black text-lg text-gray-900">Nuevo registro</p>
              <button onClick={() => setOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([["weight", "Peso (kg)"], ["waist", "Cintura (cm)"], ["chest", "Pecho (cm)"], ["arms", "Brazo (cm)"], ["hips", "Cadera (cm)"], ["legs", "Pierna (cm)"], ["bodyFat", "% grasa"]] as const).map(([k, label]) => (
                <label key={k} className={cn("space-y-1", k === "weight" && "col-span-2")}>
                  <span className="text-xs text-gray-500">{label}</span>
                  <input inputMode="decimal" className={darkInput} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value.replace(",", ".") })} />
                </label>
              ))}
            </div>
            <button onClick={saveMeasure} className="w-full h-12 rounded-xl bg-orange-500 text-white font-bold">Guardar</button>
          </div>
        </div>
      )}
    </>
  )
}
