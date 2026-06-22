"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"

interface Class {
  id: string
  name: string
  color: string
  maxCapacity: number
  description?: string | null
  _count?: { slots: number }
}

const PRESET_COLORS = ["#6366f1", "#ef4444", "#f59e0b", "#10b981", "#06b6d4", "#ec4899", "#8b5cf6", "#f97316"]

export default function ClassesClient({ initialClasses }: { initialClasses: Class[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", color: "#6366f1", maxCapacity: "20", description: "" })

  async function handleDelete(cls: Class) {
    if (!window.confirm(`¿Eliminar la clase "${cls.name}"? También se eliminarán sus horarios.`)) return
    setDeletingId(cls.id)
    const res = await fetch(`/api/classes/${cls.id}`, { method: "DELETE" })
    setDeletingId(null)
    if (res.ok) {
      toast.success("Clase eliminada")
      router.refresh()
    } else {
      toast.error("Error al eliminar la clase")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) {
      toast.success("Clase creada")
      setOpen(false)
      setForm({ name: "", color: "#6366f1", maxCapacity: "20", description: "" })
      router.refresh()
    } else {
      toast.error("Error al crear la clase")
    }
  }

  return (
    <main className="flex-1 p-3 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Catálogo de clases</h2>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Nueva clase
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva clase</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label>Capacidad máx.</Label>
              <Input type="number" value={form.maxCapacity} onChange={(e) => setForm({ ...form, maxCapacity: e.target.value })} min="1" required />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {PRESET_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: form.color === c ? "#000" : "transparent" }}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={loading}>
              {loading ? "Creando..." : "Crear clase"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {initialClasses.map((cls) => (
          <Card key={cls.id} className="overflow-hidden">
            <div className="h-2" style={{ backgroundColor: cls.color }} />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cls.color }} />
                  {cls.name}
                </CardTitle>
                <button
                  onClick={() => handleDelete(cls)}
                  disabled={deletingId === cls.id}
                  className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                  title="Eliminar clase"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-1">
              <p>Capacidad: {cls.maxCapacity} personas</p>
              {cls._count && <p>Horarios: {cls._count.slots}</p>}
              {cls.description && <p className="text-xs text-gray-400">{cls.description}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {initialClasses.length === 0 && (
        <p className="text-center text-gray-400 py-12 text-sm">No hay clases. Crea la primera.</p>
      )}
    </main>
  )
}
