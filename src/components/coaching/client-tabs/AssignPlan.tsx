"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Btn, Select, api } from "@/components/coaching/kit"

/** Asigna una plantilla (rutina o plan nutricional) al cliente, o crea uno vacío para editar. */
export default function AssignPlan({
  kind,
  clientId,
  templates,
  basePath = "/coaching",
}: {
  kind: "program" | "mealPlan"
  clientId: string
  templates: { id: string; name: string }[]
  /** Panel donde vive el editor: "/coaching" (coach) o "/trainer" (entrenador). */
  basePath?: string
}) {
  const router = useRouter()
  const [templateId, setTemplateId] = useState("")
  const [busy, setBusy] = useState(false)
  const base = kind === "program" ? "/api/coaching/programs" : "/api/coaching/meal-plans"
  const editBase = kind === "program" ? `${basePath}/programs` : "/coaching/nutrition"

  async function assign() {
    if (!templateId) return
    if (!confirm("Se asignará una copia de la plantilla y se desactivará el plan actual. ¿Continuar?")) return
    setBusy(true)
    try {
      const [created] = await api<{ id: string }[]>(`${base}/${templateId}/assign`, "POST", { clientId })
      toast.success("Asignado. Puedes personalizarlo.")
      router.push(`${editBase}/${created.id}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function createEmpty() {
    setBusy(true)
    try {
      const created = await api<{ id: string }>(base, "POST", { clientId, name: kind === "program" ? "Programa personalizado" : "Plan personalizado" })
      router.push(`${editBase}/${created.id}`)
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }

  if (templates.length === 0) {
    const libLink = kind === "program" ? `${basePath}/programs` : "/coaching/nutrition"
    const libLabel = kind === "program" ? "Rutinas" : "Nutrición"
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600">{kind === "program" ? "Asignar rutina" : "Asignar plan nutricional"}</p>
        <p className="text-xs text-gray-400">
          No hay plantillas aún.{" "}
          <a href={libLink} className="text-orange-500 hover:underline">Ir a {libLabel} → crear una plantilla</a>
          {" "}y luego vuelve aquí a asignarla.
        </p>
        <Btn variant="outline" size="sm" className="w-full" onClick={createEmpty} disabled={busy}>+ Crear desde cero</Btn>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-600">{kind === "program" ? "Asignar rutina" : "Asignar plan nutricional"}</p>
      <div className="flex gap-2">
        <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="flex-1">
          <option value="">Elegir plantilla…</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Btn onClick={assign} disabled={!templateId || busy}>Asignar</Btn>
      </div>
      <Btn variant="outline" size="sm" className="w-full" onClick={createEmpty} disabled={busy}>+ Crear desde cero</Btn>
    </div>
  )
}
