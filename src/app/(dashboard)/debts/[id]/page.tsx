"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, Pencil, X, Check } from "lucide-react"
import { format } from "date-fns"

interface DebtPayment {
  id: string
  amount: number
  currency: string
  notes?: string | null
  date: string
}

interface Debt {
  id: string
  name: string
  creditor?: string | null
  totalAmount: number
  currency: string
  monthlyPayment?: number | null
  startDate?: string | null
  dueDate?: string | null
  notes?: string | null
  payments: DebtPayment[]
}

function formatMoney(amount: number, currency: string) {
  return currency === "USD" ? `$ ${amount.toFixed(2)}` : `S/ ${amount.toFixed(2)}`
}

function fmtDate(d?: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })
}

export default function DebtDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [debt, setDebt] = useState<Debt | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingPayment, setAddingPayment] = useState(false)
  const [payForm, setPayForm] = useState({ amount: "", currency: "PEN", notes: "", date: format(new Date(), "yyyy-MM-dd") })
  const [payLoading, setPayLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Debt>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/debts/${id}`)
    if (res.ok) {
      const data = await res.json()
      setDebt(data)
      setEditForm({
        name: data.name,
        creditor: data.creditor ?? "",
        totalAmount: data.totalAmount,
        currency: data.currency,
        monthlyPayment: data.monthlyPayment ?? "",
        startDate: data.startDate ? data.startDate.slice(0, 10) : "",
        dueDate: data.dueDate ? data.dueDate.slice(0, 10) : "",
        notes: data.notes ?? "",
      })
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault()
    setPayLoading(true)
    const res = await fetch(`/api/debts/${id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payForm),
    })
    setPayLoading(false)
    if (res.ok) {
      toast.success("Abono registrado")
      setAddingPayment(false)
      setPayForm({ amount: "", currency: debt?.currency ?? "PEN", notes: "", date: format(new Date(), "yyyy-MM-dd") })
      load()
    } else {
      toast.error("Error al registrar abono")
    }
  }

  async function deletePayment(paymentId: string) {
    await fetch(`/api/debts/${id}/payments?paymentId=${paymentId}`, { method: "DELETE" })
    toast.success("Abono eliminado")
    load()
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(`/api/debts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    })
    if (res.ok) {
      toast.success("Deuda actualizada")
      setEditing(false)
      load()
    } else {
      toast.error("Error al actualizar")
    }
  }

  async function deleteDebt() {
    await fetch(`/api/debts/${id}`, { method: "DELETE" })
    toast.success("Deuda eliminada")
    router.push("/debts")
  }

  if (loading) return <main className="flex-1 p-6 text-gray-400">Cargando...</main>
  if (!debt) return <main className="flex-1 p-6 text-gray-400">No encontrado.</main>

  const paid = debt.payments.reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(debt.totalAmount - paid, 0)
  const pct = Math.min((paid / debt.totalAmount) * 100, 100)
  const isOverdue = debt.dueDate && new Date(debt.dueDate) < new Date() && remaining > 0

  return (
    <main className="flex-1 p-3 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/debts"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-xl font-semibold truncate">{debt.name}</h1>
        {isOverdue && <Badge variant="destructive">Vencida</Badge>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Info card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Información</CardTitle>
            <div className="flex gap-2">
              {!editing && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1">
                    <Pencil className="h-3.5 w-3.5" />Editar
                  </Button>
                  {confirmDelete ? (
                    <>
                      <Button size="sm" variant="destructive" onClick={deleteDebt}>Confirmar</Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}><X className="h-3.5 w-3.5" /></Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" className="text-red-500" onClick={() => setConfirmDelete(true)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editing ? (
              <form onSubmit={saveEdit} className="space-y-3">
                <div>
                  <Label className="text-xs">Nombre *</Label>
                  <Input value={editForm.name as string} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                </div>
                <div>
                  <Label className="text-xs">Acreedor</Label>
                  <Input value={editForm.creditor as string} onChange={(e) => setEditForm({ ...editForm, creditor: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Moneda</Label>
                  <div className="flex gap-2 mt-1">
                    {["PEN", "USD"].map((cur) => (
                      <button key={cur} type="button" onClick={() => setEditForm({ ...editForm, currency: cur })}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${editForm.currency === cur ? "bg-orange-500 text-white border-orange-500" : "border-gray-300 text-gray-600"}`}>
                        {cur === "PEN" ? "S/ Soles" : "$ Dólares"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Total *</Label>
                    <Input type="number" step="0.01" value={editForm.totalAmount as number} onChange={(e) => setEditForm({ ...editForm, totalAmount: Number(e.target.value) })} required />
                  </div>
                  <div>
                    <Label className="text-xs">Cuota mensual</Label>
                    <Input type="number" step="0.01" value={editForm.monthlyPayment as number} onChange={(e) => setEditForm({ ...editForm, monthlyPayment: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Inicio</Label>
                    <Input type="date" value={editForm.startDate as string} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Vencimiento</Label>
                    <Input type="date" value={editForm.dueDate as string} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notas</Label>
                  <Input value={editForm.notes as string} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" className="bg-orange-500 hover:bg-orange-600 flex-1"><Check className="h-3.5 w-3.5 mr-1" />Guardar</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                </div>
              </form>
            ) : (
              <div className="space-y-3 text-sm">
                {debt.creditor && <div><span className="text-gray-500">Acreedor:</span> <span className="font-medium">{debt.creditor}</span></div>}
                <div><span className="text-gray-500">Total:</span> <span className="font-medium">{formatMoney(debt.totalAmount, debt.currency)}</span></div>
                {debt.monthlyPayment && <div><span className="text-gray-500">Cuota mensual:</span> <span className="font-medium">{formatMoney(debt.monthlyPayment, debt.currency)}</span></div>}
                {debt.startDate && <div><span className="text-gray-500">Inicio:</span> <span className="font-medium">{fmtDate(debt.startDate)}</span></div>}
                {debt.dueDate && <div><span className="text-gray-500">Vencimiento:</span> <span className={`font-medium ${isOverdue ? "text-red-600" : ""}`}>{fmtDate(debt.dueDate)}</span></div>}
                {debt.notes && <div><span className="text-gray-500">Notas:</span> <span className="font-medium">{debt.notes}</span></div>}

                {/* Progress */}
                <div className="pt-2 border-t space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pagado</span>
                    <span className="font-semibold text-green-600">{formatMoney(paid, debt.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pendiente</span>
                    <span className="font-bold text-red-600">{formatMoney(remaining, debt.currency)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-right text-gray-400">{pct.toFixed(1)}% pagado</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Historial de abonos</CardTitle>
            <Button size="sm" className="bg-green-500 hover:bg-green-600 gap-1" onClick={() => setAddingPayment(!addingPayment)}>
              <Plus className="h-3.5 w-3.5" />Abonar
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {addingPayment && (
              <form onSubmit={submitPayment} className="space-y-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs font-semibold text-green-700">Registrar abono</p>
                <div>
                  <Label className="text-xs">Moneda</Label>
                  <div className="flex gap-2 mt-1">
                    {["PEN", "USD"].map((cur) => (
                      <button key={cur} type="button" onClick={() => setPayForm({ ...payForm, currency: cur })}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${payForm.currency === cur ? "bg-green-500 text-white border-green-500" : "border-gray-300 text-gray-600"}`}>
                        {cur === "PEN" ? "S/ Soles" : "$ Dólares"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Monto *</Label>
                    <Input type="number" step="0.01" min="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required placeholder="0.00" />
                  </div>
                  <div>
                    <Label className="text-xs">Fecha</Label>
                    <Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notas</Label>
                  <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Ej: cuota 3 de 12" />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" className="bg-green-500 hover:bg-green-600 flex-1" disabled={payLoading}>
                    {payLoading ? "Guardando..." : "Registrar abono"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setAddingPayment(false)}>Cancelar</Button>
                </div>
              </form>
            )}

            {debt.payments.length === 0 && !addingPayment && (
              <p className="text-sm text-gray-400">Sin abonos registrados.</p>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {debt.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-green-600">{formatMoney(p.amount, p.currency)}</p>
                    <p className="text-xs text-gray-400">{fmtDate(p.date)}{p.notes && ` · ${p.notes}`}</p>
                  </div>
                  <button onClick={() => deletePayment(p.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
