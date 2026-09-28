"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Zap } from "lucide-react"
import { Btn, Input, Panel, Select, Textarea, api } from "@/components/coaching/kit"

type Rule = { id: string; type: string; enabled: boolean; days: number | null; channel: string; message: string; label: string; description: string; hasDays: boolean }

export default function AutomationsEditor({ rules: initial }: { rules: Rule[] }) {
  const router = useRouter()
  const [rules, setRules] = useState(initial)
  const [busy, setBusy] = useState(false)
  const set = (id: string, patch: Partial<Rule>) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  async function save() {
    setBusy(true)
    try {
      await api("/api/coaching/automations", "PUT", { rules })
      toast.success("Automatizaciones guardadas")
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function run() {
    setBusy(true)
    try {
      await api("/api/coaching/automations", "PUT", { rules })
      const r = await api<{ sent: number }>("/api/coaching/automations/run", "POST")
      toast.success(r.sent ? `${r.sent} envíos realizados` : "Nada que enviar hoy")
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        {rules.map((r) => (
          <Panel key={r.id} className={r.enabled ? "" : "opacity-60"}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-semibold text-sm">{r.label}</p>
                <p className="text-xs text-gray-500">{r.description}</p>
              </div>
              <label className="flex items-center gap-1.5 text-xs shrink-0">
                <input type="checkbox" checked={r.enabled} onChange={(e) => set(r.id, { enabled: e.target.checked })} /> Activa
              </label>
            </div>
            <div className="flex gap-2 mb-2">
              {r.hasDays && (
                <div className="flex items-center gap-1 text-xs">
                  <Input type="number" min={1} className="h-8 w-16" value={r.days ?? ""} onChange={(e) => set(r.id, { days: Number(e.target.value) || null })} /> días
                </div>
              )}
              <Select className="h-8 text-xs" value={r.channel} onChange={(e) => set(r.id, { channel: e.target.value })}>
                <option value="CHAT">Mensaje en el chat</option>
                <option value="NOTIFICATION">Notificación en la app</option>
              </Select>
            </div>
            <Textarea rows={2} value={r.message} onChange={(e) => set(r.id, { message: e.target.value })} />
          </Panel>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Btn variant="outline" onClick={run} disabled={busy}><Zap className="h-4 w-4" /> Guardar y ejecutar ahora</Btn>
        <Btn onClick={save} disabled={busy}>Guardar</Btn>
      </div>
    </div>
  )
}
