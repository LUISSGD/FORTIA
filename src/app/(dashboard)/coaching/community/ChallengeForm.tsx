"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { CHALLENGE_METRICS } from "@/lib/coaching/constants"
import { Btn, Field, Input, Modal, Select, Textarea, api } from "@/components/coaching/kit"

function monthRange() {
  const t = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date())
  const [y, m] = t.split("-").map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { start: `${t.slice(0, 7)}-01`, end: `${t.slice(0, 7)}-${last}` }
}

export default function ChallengeForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const r = monthRange()
  const [f, setF] = useState({ title: "30 días de consistencia", description: "Completa tus entrenamientos y registra tu alimentación todos los días.", metric: "ACTIVE_DAYS", target: "24", startDate: r.start, endDate: r.end, showRanking: true })
  async function save() {
    try {
      await api("/api/coaching/challenges", "POST", f)
      toast.success("Reto creado y notificado a tus clientes")
      setOpen(false)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  return (
    <>
      <Btn onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuevo reto</Btn>
      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo reto">
        <div className="space-y-3">
          <Field label="Título"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Descripción"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Métrica">
              <Select value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })}>
                {Object.entries(CHALLENGE_METRICS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Meta"><Input type="number" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
            <Field label="Inicio"><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
            <Field label="Fin"><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.showRanking} onChange={(e) => setF({ ...f, showRanking: e.target.checked })} /> Mostrar ranking a los clientes
          </label>
          <Btn className="w-full" onClick={save}>Crear reto</Btn>
        </div>
      </Modal>
    </>
  )
}
