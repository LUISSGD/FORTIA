"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"

const PRESETS = [
  { label: "1 semana", days: 7 },
  { label: "2 semanas", days: 14 },
  { label: "1 mes", days: 30 },
]

interface Props {
  clientId: string
  membershipEnd: Date | string | null
  onUpdated?: () => void
}

export default function ExtendPlanDialog({ clientId, membershipEnd, onUpdated }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  const currentEnd = membershipEnd ? new Date(membershipEnd) : null
  const previewEnd = currentEnd && days ? new Date(new Date(currentEnd).setDate(currentEnd.getDate() + Number(days))) : null

  async function handleSave() {
    if (!days || Number(days) <= 0) { toast.error("Ingresa un número de días válido"); return }
    if (!reason.trim()) { toast.error("Ingresa una justificación"); return }
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: Number(days), reason }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(`Plan extendido ${days} días`)
      setOpen(false)
      setDays(""); setReason("")
      onUpdated?.()
      router.refresh()
    } else {
      toast.error("Error al extender el plan")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarPlus className="h-3.5 w-3.5 mr-1" />
          Extender plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Extender / Congelar plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {currentEnd && (
            <p className="text-sm text-gray-500">
              Vencimiento actual: <span className="font-medium text-gray-700">
                {currentEnd.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}
              </span>
            </p>
          )}

          <div>
            <Label className="text-xs mb-1 block">Días a agregar</Label>
            <div className="flex gap-2 mb-2">
              {PRESETS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => setDays(String(p.days))}
                  className={`text-xs px-2.5 py-1 rounded border font-medium transition-colors ${
                    days === String(p.days)
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Input
              type="number"
              min="1"
              placeholder="O escribe los días..."
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>

          {previewEnd && (
            <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-sm">
              Nuevo vencimiento:{" "}
              <span className="font-semibold text-orange-700">
                {previewEnd.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}
              </span>
            </div>
          )}

          <div>
            <Label className="text-xs mb-1 block">Justificación *</Label>
            <Input
              placeholder="Ej: Congelación por viaje, operación, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1 bg-orange-500 hover:bg-orange-600"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Confirmar extensión"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
