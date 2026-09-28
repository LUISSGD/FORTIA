"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Link2, Trash2, Undo2 } from "lucide-react"
import { PAYMENT_METHODS } from "@/lib/utils"
import { Btn, Field, Input, Modal, Select, api } from "./kit"

export type PaymentRow = {
  id: string; clientId: string; clientName: string; period: string; periodLabel: string; amount: number; currency: string
  status: string; dueDate: string; paidAt: string | null; method: string | null
}

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date())
const money = (n: number, c: string) => `${c === "USD" ? "$" : "S/"}${n.toLocaleString("es-PE")}`
const fmt = (d: string) => d.split("-").reverse().join("/")

export default function PaymentsTable({ payments, clientId, defaultAmount, showClient = false, mpEnabled = false }: { payments: PaymentRow[]; clientId?: string; defaultAmount?: number; showClient?: boolean; mpEnabled?: boolean }) {
  const router = useRouter()
  const [paying, setPaying] = useState<PaymentRow | null>(null)
  const [payForm, setPayForm] = useState({ method: "TRANSFER", paidAt: today(), amount: "" })
  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState({ period: today().slice(0, 7), amount: String(defaultAmount ?? ""), dueDate: "" })

  async function markPaid() {
    if (!paying) return
    try {
      await api(`/api/coaching/payments/${paying.id}`, "PATCH", { status: "PAID", ...payForm })
      toast.success("Pago registrado y sumado a Finanzas")
      setPaying(null)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function payLink(p: PaymentRow) {
    try {
      const { url } = await api<{ url: string }>(`/api/coaching/payments/${p.id}/checkout`, "POST")
      try {
        await navigator.clipboard.writeText(url)
        toast.success("Link de Mercado Pago copiado. Envíaselo a tu cliente.")
      } catch {
        window.prompt("Link de pago de Mercado Pago:", url)
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function create() {
    try {
      await api("/api/coaching/payments", "POST", { clientId, ...newForm })
      setAdding(false)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-3">
      {clientId && (
        <div className="flex justify-end">
          <Btn size="sm" variant="outline" onClick={() => setAdding(true)}>+ Registrar mensualidad</Btn>
        </div>
      )}
      {payments.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">Sin mensualidades registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 text-left">
              <tr>
                {showClient && <th className="py-2 pr-2 font-medium">Cliente</th>}
                <th className="py-2 pr-2 font-medium">Mes</th>
                <th className="py-2 px-2 font-medium">Monto</th>
                <th className="py-2 px-2 font-medium">Vence</th>
                <th className="py-2 px-2 font-medium">Estado</th>
                <th className="py-2 pl-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => {
                const overdue = p.status === "PENDING" && p.dueDate < today()
                return (
                  <tr key={p.id}>
                    {showClient && <td className="py-2 pr-2 font-medium">{p.clientName}</td>}
                    <td className="py-2 pr-2">{p.periodLabel}</td>
                    <td className="py-2 px-2">{money(p.amount, p.currency)}</td>
                    <td className="py-2 px-2 text-gray-500">{fmt(p.dueDate)}</td>
                    <td className="py-2 px-2">
                      {p.status === "PAID" ? (
                        <span className="text-emerald-600">✅ Pagado {p.paidAt && <span className="text-xs text-gray-400">{fmt(p.paidAt)} · {PAYMENT_METHODS[p.method ?? ""] ?? p.method}</span>}</span>
                      ) : overdue ? (
                        <span className="text-red-600 font-medium">🔴 Vencido</span>
                      ) : (
                        <span className="text-amber-600">⏳ Pendiente</span>
                      )}
                    </td>
                    <td className="py-2 pl-2 text-right whitespace-nowrap">
                      {p.status === "PENDING" && mpEnabled && (
                        <button className="p-1.5 text-sky-600 hover:text-sky-800" title="Copiar link de pago de Mercado Pago" onClick={() => payLink(p)}>
                          <Link2 className="h-4 w-4" />
                        </button>
                      )}
                      {p.status === "PENDING" ? (
                        <Btn size="sm" onClick={() => { setPaying(p); setPayForm({ method: "TRANSFER", paidAt: today(), amount: String(p.amount) }) }}>Marcar pagado</Btn>
                      ) : (
                        <button className="p-1.5 text-gray-400 hover:text-gray-700" title="Revertir a pendiente" onClick={async () => { if (confirm("¿Revertir a pendiente? Se eliminará el ingreso en Finanzas.")) { await api(`/api/coaching/payments/${p.id}`, "PATCH", { status: "PENDING" }); router.refresh() } }}>
                          <Undo2 className="h-4 w-4" />
                        </button>
                      )}
                      <button className="p-1.5 text-gray-400 hover:text-red-500" title="Eliminar" onClick={async () => { if (confirm("¿Eliminar esta mensualidad?")) { await api(`/api/coaching/payments/${p.id}`, "DELETE"); router.refresh() } }}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!paying} onClose={() => setPaying(null)} title={`Registrar pago · ${paying?.clientName ?? ""}`}>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{paying?.periodLabel}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto"><Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></Field>
            <Field label="Fecha de pago"><Input type="date" value={payForm.paidAt} onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })} /></Field>
          </div>
          <Field label="Método">
            <Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              {Object.entries(PAYMENT_METHODS).filter(([k]) => k !== "EXTENSION").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Btn className="w-full" onClick={markPaid}>Confirmar pago</Btn>
        </div>
      </Modal>

      <Modal open={adding} onClose={() => setAdding(false)} title="Nueva mensualidad">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mes"><Input type="month" value={newForm.period} onChange={(e) => setNewForm({ ...newForm, period: e.target.value })} /></Field>
            <Field label="Monto"><Input type="number" value={newForm.amount} onChange={(e) => setNewForm({ ...newForm, amount: e.target.value })} /></Field>
          </div>
          <Field label="Vencimiento (opcional)" hint="Por defecto, el día de cobro del cliente"><Input type="date" value={newForm.dueDate} onChange={(e) => setNewForm({ ...newForm, dueDate: e.target.value })} /></Field>
          <Btn className="w-full" onClick={create}>Crear</Btn>
        </div>
      </Modal>
    </div>
  )
}
