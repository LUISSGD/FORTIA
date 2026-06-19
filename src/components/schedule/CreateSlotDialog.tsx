"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { DAYS_OF_WEEK } from "@/lib/utils"

interface Class { id: string; name: string; color: string }

export default function CreateSlotDialog({ classes }: { classes: Class[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [form, setForm] = useState({
    classId: "", startTime: "07:00", endTime: "08:00", instructor: "", room: "",
  })

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleDay(i: number) {
    setSelectedDays((prev) =>
      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDays.length) {
      toast.error("Selecciona al menos un día")
      return
    }
    setLoading(true)
    const results = await Promise.all(
      selectedDays.map((day) =>
        fetch("/api/schedule/slots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, dayOfWeek: String(day) }),
        })
      )
    )
    setLoading(false)
    const errors = results.filter((r) => !r.ok)
    if (errors.length === 0) {
      toast.success(`Horario creado para ${selectedDays.length} día(s)`)
      setOpen(false)
      setSelectedDays([])
      router.refresh()
    } else {
      toast.error(`${errors.length} día(s) con error (puede que ya exista ese horario)`)
      router.refresh()
    }
  }

  return (
    <>
      <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Agregar horario
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo horario de clase</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Clase</Label>
              <Select value={form.classId} onValueChange={(v) => set("classId", v ?? "")} required>
                <SelectTrigger><SelectValue placeholder="Seleccionar clase" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Días <span className="text-gray-400 font-normal">(selecciona uno o varios)</span></Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {DAYS_OF_WEEK.map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      selectedDays.includes(i)
                        ? "bg-orange-500 text-white border-orange-500"
                        : "border-gray-300 text-gray-600 hover:border-orange-400"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              {selectedDays.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">Ningún día seleccionado</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Inicio</Label>
                <Input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} required />
              </div>
              <div>
                <Label>Fin</Label>
                <Input type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} required />
              </div>
            </div>

            <div>
              <Label>Instructor</Label>
              <Input value={form.instructor} onChange={(e) => set("instructor", e.target.value)} placeholder="Nombre del instructor" />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600 flex-1" disabled={loading || !form.classId || !selectedDays.length}>
                {loading ? "Creando..." : `Crear horario${selectedDays.length > 1 ? ` (${selectedDays.length} días)` : ""}`}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
