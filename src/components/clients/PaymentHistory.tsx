"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ImageIcon, Pencil, Trash2, X } from "lucide-react"
import { formatDate, formatCurrency, PAYMENT_METHODS } from "@/lib/utils"

interface Payment {
  id: string
  amount: number
  method: string
  concept: string | null
  periodStart: Date | string
  periodEnd: Date | string
  paidAt: Date | string
  receiptUrl: string | null
}

export default function PaymentHistory({ payments: initial }: { payments: Payment[] }) {
  const router = useRouter()
  const [payments, setPayments] = useState(initial)
  const [editing, setEditing] = useState<Payment | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editMethod, setEditMethod] = useState("")
  const [editConcept, setEditConcept] = useState("")
  const [saving, setSaving] = useState(false)

  function openEdit(p: Payment) {
    setEditing(p)
    setEditAmount(String(p.amount))
    setEditMethod(p.method)
    setEditConcept(p.concept ?? "")
  }

  async function handleSaveEdit() {
    if (!editing) return
    setSaving(true)
    const res = await fetch(`/api/payments/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: editAmount, method: editMethod, concept: editConcept }),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setPayments(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
      setEditing(null)
      toast.success("Pago actualizado")
      router.refresh()
    } else {
      toast.error("Error al actualizar el pago")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este pago? También se eliminará el ingreso asociado.")) return
    const res = await fetch(`/api/payments/${id}`, { method: "DELETE" })
    if (res.ok) {
      setPayments(prev => prev.filter(p => p.id !== id))
      toast.success("Pago eliminado")
      router.refresh()
    } else {
      toast.error("Error al eliminar el pago")
    }
  }

  async function handleRemoveReceipt(id: string) {
    const res = await fetch(`/api/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptUrl: null }),
    })
    if (res.ok) {
      setPayments(prev => prev.map(p => p.id === id ? { ...p, receiptUrl: null } : p))
      toast.success("Foto eliminada")
    } else {
      toast.error("Error al eliminar la foto")
    }
  }

  if (payments.length === 0) {
    return <p className="text-sm text-gray-500">Sin pagos registrados.</p>
  }

  return (
    <>
      <div className="space-y-3">
        {payments.map((p) => (
          <div key={p.id} className="border-l-2 border-orange-300 pl-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium">{formatCurrency(p.amount)}</p>
                <p className="text-xs text-gray-500">{PAYMENT_METHODS[p.method] ?? p.method}</p>
                <p className="text-xs text-gray-400">{formatDate(p.periodStart)} — {formatDate(p.periodEnd)}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {p.receiptUrl && (
                  <div className="flex items-center gap-0.5">
                    <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" title="Ver comprobante">
                      <ImageIcon className="h-4 w-4 text-orange-400 hover:text-orange-600" />
                    </a>
                    <button
                      onClick={() => handleRemoveReceipt(p.id)}
                      title="Quitar foto"
                      className="text-gray-300 hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <button onClick={() => openEdit(p)} title="Editar pago" className="text-gray-300 hover:text-blue-500">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(p.id)} title="Eliminar pago" className="text-gray-300 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <p className="text-xs text-gray-400 ml-1">{formatDate(p.paidAt)}</p>
              </div>
            </div>
            {p.concept && <p className="text-xs text-gray-500 mt-1">{p.concept}</p>}
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Monto (S/)</Label>
              <Input type="number" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
            </div>
            <div>
              <Label>Método de pago</Label>
              <Select value={editMethod} onValueChange={v => v && setEditMethod(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Concepto</Label>
              <Input value={editConcept} onChange={e => setEditConcept(e.target.value)} placeholder="Descripción..." />
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
