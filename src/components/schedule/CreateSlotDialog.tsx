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
  const [form, setForm] = useState({
    classId: "", dayOfWeek: "0", startTime: "07:00", endTime: "08:00", instructor: "", room: "",
  })

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/schedule/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) {
      toast.success("Horario creado")
      setOpen(false)
      router.refresh()
    } else {
      const err = await res.json()
      toast.error(err.error ?? "Error al crear el horario")
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
            <Label>Día</Label>
            <Select value={form.dayOfWeek} onValueChange={(v) => set("dayOfWeek", v ?? "")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
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
            <Button type="submit" className="bg-orange-500 hover:bg-orange-600 flex-1" disabled={loading || !form.classId}>
              {loading ? "Creando..." : "Crear horario"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
