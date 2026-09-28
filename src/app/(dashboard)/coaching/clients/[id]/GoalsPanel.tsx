"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2, Check } from "lucide-react"
import { Btn, Field, Input, Panel, ProgressBar, Select, api } from "@/components/coaching/kit"

type Goal = { id: string; title: string; metric: string | null; startValue: number | null; targetValue: number | null; unit: string | null; dueDate: string | null; achievedAt: string | null }

export default function GoalsPanel({ clientId, goals, currentWeight }: { clientId: string; goals: Goal[]; currentWeight: number | null }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ title: "", metric: "WEIGHT", startValue: currentWeight ? String(currentWeight) : "", targetValue: "", unit: "kg", dueDate: "" })

  async function add() {
    try {
      await api(`/api/coaching/clients/${clientId}/goals`, "POST", f)
      setAdding(false)
      setF((x) => ({ ...x, title: "", targetValue: "" }))
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Panel title="🎯 Objetivos" action={<Btn size="sm" variant="ghost" onClick={() => setAdding((a) => !a)}><Plus className="h-3.5 w-3.5" /> Nuevo</Btn>}>
      {adding && (
        <div className="space-y-2 mb-3 p-3 bg-gray-50 rounded-lg">
          <Field label="Objetivo"><Input placeholder="Ej: Bajar a 78 kg" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Métrica">
              <Select value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value, unit: e.target.value === "WAIST" ? "cm" : e.target.value === "WEIGHT" ? "kg" : f.unit })}>
                <option value="WEIGHT">Peso</option><option value="WAIST">Cintura</option><option value="CUSTOM">Otra</option>
              </Select>
            </Field>
            <Field label="Inicio"><Input type="number" value={f.startValue} onChange={(e) => setF({ ...f, startValue: e.target.value })} /></Field>
            <Field label="Meta"><Input type="number" value={f.targetValue} onChange={(e) => setF({ ...f, targetValue: e.target.value })} /></Field>
          </div>
          <Field label="Fecha límite"><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
          <Btn onClick={add} className="w-full">Guardar objetivo</Btn>
        </div>
      )}
      {goals.length === 0 && !adding && <p className="text-sm text-gray-500">Define metas claras: peso, cintura, marcas…</p>}
      <ul className="space-y-3">
        {goals.map((g) => {
          const current = g.metric === "WEIGHT" ? currentWeight : null
          const progress = g.startValue !== null && g.targetValue !== null && current !== null && g.startValue !== g.targetValue
            ? Math.max(0, Math.min(1, (g.startValue - current) / (g.startValue - g.targetValue)))
            : null
          return (
            <li key={g.id} className="text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={g.achievedAt ? "line-through text-gray-400" : "font-medium"}>{g.achievedAt ? "✅ " : ""}{g.title}</p>
                  <p className="text-xs text-gray-500">
                    {g.startValue ?? "?"} → {g.targetValue ?? "?"} {g.unit}{g.dueDate ? ` · hasta ${g.dueDate.split("-").reverse().join("/")}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title={g.achievedAt ? "Marcar pendiente" : "Marcar cumplido"} onClick={async () => { await api(`/api/coaching/goals/${g.id}`, "PATCH", { achieved: !g.achievedAt }); router.refresh() }}>
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button className="p-1 text-gray-400 hover:text-red-500 rounded" onClick={async () => { if (confirm("¿Eliminar objetivo?")) { await api(`/api/coaching/goals/${g.id}`, "DELETE"); router.refresh() } }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {progress !== null && !g.achievedAt && <ProgressBar value={progress * 100} max={100} className="mt-1" />}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
