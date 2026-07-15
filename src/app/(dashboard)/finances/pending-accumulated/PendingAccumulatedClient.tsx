"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Plus, Trash2, Check, AlertCircle } from "lucide-react"

interface Item {
  id: string
  concept: string
  currency: string
  amount: number
  month: number
  year: number
  status: string
  notes: string | null
}

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

function fmt(amount: number, currency: string) {
  return currency === "USD" ? `$ ${amount.toFixed(2)}` : `S/ ${amount.toFixed(2)}`
}

function periodoLabel(month: number, year: number) {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

export default function PendingAccumulatedClient() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const now = new Date()
  const [form, setForm] = useState({
    concept: "", currency: "PEN", amount: "",
    month: String(now.getMonth() + 1), year: String(now.getFullYear()), notes: ""
  })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/finances/monthly-expenses/pending")
    const data = await res.json()
    setItems(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  function openNew() {
    setForm({ concept: "", currency: "PEN", amount: "", month: String(now.getMonth() + 1), year: String(now.getFullYear()), notes: "" })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.concept || !form.amount) return
    setSaving(true)
    const res = await fetch("/api/finances/monthly-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        concept: form.concept,
        currency: form.currency,
        amount: Number(form.amount),
        month: Number(form.month),
        year: Number(form.year),
        status: "PENDIENTE",
        notes: form.notes || null,
      }),
    })
    setSaving(false)
    if (res.ok) { toast.success("Gasto pendiente agregado"); setDialogOpen(false); fetchItems() }
    else toast.error("Error al agregar")
  }

  async function markPaid(item: Item) {
    const res = await fetch(`/api/finances/monthly-expenses/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept: item.concept, currency: item.currency, amount: item.amount, status: "PAGADO", notes: item.notes }),
    })
    if (res.ok) { toast.success("Marcado como PAGADO"); fetchItems() }
    else toast.error("Error al actualizar")
  }

  async function deleteItem(id: string) {
    if (!confirm("¿Eliminar este gasto pendiente?")) return
    const res = await fetch(`/api/finances/monthly-expenses/${id}`, { method: "DELETE" })
    if (res.ok) { toast.success("Eliminado"); fetchItems() }
    else toast.error("Error al eliminar")
  }

  const totalPEN = items.filter(i => i.currency === "PEN").reduce((s, i) => s + i.amount, 0)
  const totalUSD = items.filter(i => i.currency === "USD").reduce((s, i) => s + i.amount, 0)

  return (
    <div className="flex-1 p-3 md:p-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          <span className="text-sm text-gray-500">{items.length} gastos pendientes</span>
        </div>
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />Agregar pendiente
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Concepto</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600">Período</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600">Moneda</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Monto</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-green-600 font-medium">¡Sin gastos pendientes acumulados!</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className="hover:bg-orange-50/30">
                  <td className="px-4 py-3 font-medium">{item.concept}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 font-medium">
                      {periodoLabel(item.month, item.year)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-xs font-medium text-gray-500">{item.currency === "USD" ? "USD" : "SOLES"}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(item.amount, item.currency)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => markPaid(item)}
                        title="Marcar como PAGADO"
                        className="p-1.5 rounded hover:bg-green-50 text-green-600"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-orange-600 mb-2">TOTAL PENDIENTE ACUMULADO</p>
          {totalPEN > 0 && <p className="text-xl font-bold text-orange-700">S/ {totalPEN.toFixed(2)}</p>}
          {totalUSD > 0 && <p className="text-base font-bold text-orange-600">$ {totalUSD.toFixed(2)}</p>}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar gasto pendiente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Concepto</Label>
              <Input value={form.concept} onChange={e => setForm(f => ({ ...f, concept: e.target.value }))} placeholder="Ej: PDT Detracción Alquileres" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mes del período</Label>
                <Select value={form.month} onValueChange={v => setForm(f => ({ ...f, month: v ?? "1" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Año</Label>
                <Input value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="2026" />
              </div>
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
                {saving ? "Guardando..." : "Agregar"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
