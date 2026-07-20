"use client"

import { useState } from "react"
import { Plus, Trash2, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface PhysicalRecord {
  id: string
  date: string
  weight: number | null
  height: number | null
  bodyFat: number | null
  chest: number | null
  waist: number | null
  hips: number | null
  arms: number | null
  legs: number | null
  notes: string | null
}

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

function formatDate(d: string) {
  const dt = new Date(d)
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`
}

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  weight: "",
  height: "",
  bodyFat: "",
  chest: "",
  waist: "",
  hips: "",
  arms: "",
  legs: "",
  notes: "",
}

export default function PhysicalTrackingSection({
  clientId,
  initialRecords,
}: {
  clientId: string
  initialRecords: PhysicalRecord[]
}) {
  const [records, setRecords] = useState(initialRecords)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/physical`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      const newRecord = await res.json()
      setRecords((prev) => [newRecord, ...prev])
      setForm(EMPTY_FORM)
      setOpen(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este registro?")) return
    const res = await fetch(`/api/clients/${clientId}/physical/${id}`, { method: "DELETE" })
    if (res.ok) setRecords((prev) => prev.filter((r) => r.id !== id))
  }

  const latest = records[0]

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-orange-500" />
          <h3 className="font-semibold text-sm">Seguimiento Físico</h3>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex items-center gap-1 text-xs bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1.5 rounded-md font-medium transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Nuevo registro
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Nuevo registro físico</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <div>
                <Label className="text-xs">Fecha</Label>
                <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Peso (kg)</Label>
                  <Input type="number" step="0.1" placeholder="70.5" value={form.weight} onChange={(e) => set("weight", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Talla (cm)</Label>
                  <Input type="number" placeholder="170" value={form.height} onChange={(e) => set("height", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Grasa (%)</Label>
                  <Input type="number" step="0.1" placeholder="18.0" value={form.bodyFat} onChange={(e) => set("bodyFat", e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-gray-500 font-medium">Medidas (cm)</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Pecho</Label>
                  <Input type="number" step="0.1" value={form.chest} onChange={(e) => set("chest", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Cintura</Label>
                  <Input type="number" step="0.1" value={form.waist} onChange={(e) => set("waist", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Cadera</Label>
                  <Input type="number" step="0.1" value={form.hips} onChange={(e) => set("hips", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Brazos</Label>
                  <Input type="number" step="0.1" value={form.arms} onChange={(e) => set("arms", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Piernas</Label>
                  <Input type="number" step="0.1" value={form.legs} onChange={(e) => set("legs", e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Notas</Label>
                <Input placeholder="Observaciones..." value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                {saving ? "Guardando..." : "Guardar registro"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Latest snapshot */}
      {latest && (
        <div className="bg-orange-50 rounded-lg p-3 text-xs space-y-1">
          <p className="text-gray-500 font-medium">Último registro — {formatDate(latest.date)}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-700">
            {latest.weight && <span>Peso: <strong>{latest.weight} kg</strong></span>}
            {latest.bodyFat && <span>Grasa: <strong>{latest.bodyFat}%</strong></span>}
            {latest.waist && <span>Cintura: <strong>{latest.waist} cm</strong></span>}
            {latest.chest && <span>Pecho: <strong>{latest.chest} cm</strong></span>}
            {latest.hips && <span>Cadera: <strong>{latest.hips} cm</strong></span>}
            {latest.arms && <span>Brazos: <strong>{latest.arms} cm</strong></span>}
            {latest.legs && <span>Piernas: <strong>{latest.legs} cm</strong></span>}
          </div>
          {latest.notes && <p className="text-gray-500 italic">{latest.notes}</p>}
        </div>
      )}

      {/* History */}
      {records.length > 1 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          <p className="text-xs font-medium text-gray-400 uppercase">Historial</p>
          {records.slice(1).map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-3 py-2">
              <span className="text-gray-500 w-24 shrink-0">{formatDate(r.date)}</span>
              <span className="flex-1 text-gray-700">
                {[
                  r.weight && `${r.weight}kg`,
                  r.bodyFat && `${r.bodyFat}%`,
                  r.waist && `C:${r.waist}cm`,
                ].filter(Boolean).join(" · ")}
              </span>
              <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-400 ml-2">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {records.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-3">Sin registros aún. Agrega el primero.</p>
      )}
    </div>
  )
}
