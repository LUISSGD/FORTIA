"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Plus, Copy, Pencil, Trash2, Check } from "lucide-react"

interface Item {
  id: string
  concept: string
  currency: string
  amount: number
  month: number
  year: number
  status: string
  paidAt: string | null
  notes: string | null
}

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

function fmt(amount: number, currency: string) {
  return currency === "USD" ? `$ ${amount.toFixed(2)}` : `S/ ${amount.toFixed(2)}`
}

export default function MonthlyExpensesClient() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [form, setForm] = useState({ concept: "", currency: "PEN", amount: "", notes: "" })
  const [saving, setSaving] = useState(false)
  const [copyLoading, setCopyLoading] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/finances/monthly-expenses?month=${month}&year=${year}`)
    const data = await res.json()
    setItems(data)
    setLoading(false)
  }, [month, year])

  useEffect(() => { fetchItems() }, [fetchItems])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function openNew() {
    setEditItem(null)
    setForm({ concept: "", currency: "PEN", amount: "", notes: "" })
    setDialogOpen(true)
  }

  function openEdit(item: Item) {
    setEditItem(item)
    setForm({ concept: item.concept, currency: item.currency, amount: String(item.amount), notes: item.notes ?? "" })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.concept || !form.amount) return
    setSaving(true)
    if (editItem) {
      const res = await fetch(`/api/finances/monthly-expenses/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status: editItem.status }),
      })
      if (res.ok) { toast.success("Actualizado"); setDialogOpen(false); fetchItems() }
      else toast.error("Error al actualizar")
    } else {
      const res = await fetch("/api/finances/monthly-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, month, year }),
      })
      if (res.ok) { toast.success("Gasto agregado"); setDialogOpen(false); fetchItems() }
      else toast.error("Error al agregar")
    }
    setSaving(false)
  }

  async function toggleStatus(item: Item) {
    const newStatus = item.status === "PAGADO" ? "PENDIENTE" : "PAGADO"
    const res = await fetch(`/api/finances/monthly-expenses/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept: item.concept, currency: item.currency, amount: item.amount, status: newStatus, notes: item.notes }),
    })
    if (res.ok) fetchItems()
    else toast.error("Error al actualizar estado")
  }

  async function deleteItem(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return
    const res = await fetch(`/api/finances/monthly-expenses/${id}`, { method: "DELETE" })
    if (res.ok) { toast.success("Eliminado"); fetchItems() }
    else toast.error("Error al eliminar")
  }

  async function copyFromPrevMonth() {
    const prevM = month === 1 ? 12 : month - 1
    const prevY = month === 1 ? year - 1 : year
    setCopyLoading(true)
    const res = await fetch(`/api/finances/monthly-expenses?month=${prevM}&year=${prevY}`)
    const prevItems: Item[] = await res.json()
    if (prevItems.length === 0) { toast.error("No hay gastos en el mes anterior"); setCopyLoading(false); return }
    await Promise.all(prevItems.map(item =>
      fetch("/api/finances/monthly-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept: item.concept, currency: item.currency, amount: item.amount, month, year, status: "PENDIENTE", notes: item.notes }),
      })
    ))
    toast.success(`${prevItems.length} gastos copiados como PENDIENTE`)
    fetchItems()
    setCopyLoading(false)
  }

  const pagadoPEN = items.filter(i => i.status === "PAGADO" && i.currency === "PEN").reduce((s, i) => s + i.amount, 0)
  const pagadoUSD = items.filter(i => i.status === "PAGADO" && i.currency === "USD").reduce((s, i) => s + i.amount, 0)
  const pendientePEN = items.filter(i => i.status === "PENDIENTE" && i.currency === "PEN").reduce((s, i) => s + i.amount, 0)
  const pendienteUSD = items.filter(i => i.status === "PENDIENTE" && i.currency === "USD").reduce((s, i) => s + i.amount, 0)

  return (
    <div className="flex-1 p-3 md:p-6">
      {/* Month navigator */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg border hover:bg-gray-50"><ChevronLeft className="h-4 w-4" /></button>
          <h2 className="text-lg font-semibold w-44 text-center">{MONTH_NAMES[month - 1]} {year}</h2>
          <button onClick={nextMonth} className="p-1.5 rounded-lg border hover:bg-gray-50"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyFromPrevMonth} disabled={copyLoading || items.length > 0}>
            <Copy className="h-4 w-4 mr-1" />
            {copyLoading ? "Copiando..." : "Copiar mes anterior"}
          </Button>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" />Agregar
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Concepto</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600">Moneda</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Monto</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Sin gastos para este mes. Agrega uno o copia del mes anterior.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className={item.status === "PAGADO" ? "bg-green-50/40" : ""}>
                  <td className="px-4 py-3 font-medium">{item.concept}</td>
                  <td className="px-3 py-3 text-center">
                    <Badge variant="outline" className={item.currency === "USD" ? "border-blue-300 text-blue-700" : "border-gray-300"}>
                      {item.currency === "USD" ? "USD" : "SOLES"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(item.amount, item.currency)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleStatus(item)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                        item.status === "PAGADO"
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                      }`}
                    >
                      {item.status === "PAGADO" && <Check className="h-3 w-3" />}
                      {item.status}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-green-600 mb-2">PAGADO</p>
            {pagadoPEN > 0 && <p className="text-lg font-bold text-green-700">S/ {pagadoPEN.toFixed(2)}</p>}
            {pagadoUSD > 0 && <p className="text-base font-bold text-green-600">$ {pagadoUSD.toFixed(2)}</p>}
            {pagadoPEN === 0 && pagadoUSD === 0 && <p className="text-sm text-green-500">—</p>}
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-orange-600 mb-2">PENDIENTE</p>
            {pendientePEN > 0 && <p className="text-lg font-bold text-orange-700">S/ {pendientePEN.toFixed(2)}</p>}
            {pendienteUSD > 0 && <p className="text-base font-bold text-orange-600">$ {pendienteUSD.toFixed(2)}</p>}
            {pendientePEN === 0 && pendienteUSD === 0 && <p className="text-sm text-orange-500">—</p>}
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar gasto" : "Nuevo gasto corriente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Concepto</Label>
              <Input value={form.concept} onChange={e => setForm(f => ({ ...f, concept: e.target.value }))} placeholder="Ej: Alquiler LOCAL" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Moneda</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v ?? "PEN" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PEN">SOLES</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monto</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observación..." />
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="bg-orange-500 hover:bg-orange-600 flex-1" onClick={handleSave} disabled={saving || !form.concept || !form.amount}>
                {saving ? "Guardando..." : editItem ? "Guardar cambios" : "Agregar"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
