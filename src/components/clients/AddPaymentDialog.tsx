"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { PAYMENT_METHODS } from "@/lib/utils"
import { PlusCircle } from "lucide-react"

interface Plan {
  id: string
  name: string
  price: number
  durationDays: number
}

interface Props {
  clientId: string
  clientName: string
  plans: Plan[]
  currentPlanId?: string | null
}

export default function AddPaymentDialog({ clientId, clientName, plans, currentPlanId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [planId, setPlanId] = useState(currentPlanId ?? "")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("CASH")

  const selectedPlan = plans.find((p) => p.id === planId)

  function handlePlanChange(id: string) {
    setPlanId(id)
    const plan = plans.find((p) => p.id === id)
    if (plan) setAmount(String(plan.price))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, planId, amount, method }),
    })
    setLoading(false)
    if (res.ok) {
      toast.success("Pago registrado. Membresía renovada.")
      setOpen(false)
      router.refresh()
    } else {
      toast.error("Error al registrar el pago")
    }
  }

  return (
    <>
      <Button className="bg-orange-500 hover:bg-orange-600" size="sm" onClick={() => setOpen(true)}>
        <PlusCircle className="h-4 w-4 mr-2" />
        Registrar pago
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pago — {clientName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Plan</Label>
            <Select value={planId} onValueChange={(v) => v && handlePlanChange(v)} required>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — S/ {p.price}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Monto (S/)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required min="0" />
          </div>
          <div>
            <Label>Método de pago</Label>
            <Select value={method} onValueChange={(v) => v && setMethod(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedPlan && (
            <p className="text-xs text-gray-500">
              Extenderá la membresía {selectedPlan.durationDays} días desde hoy (o desde el vencimiento actual si aún no ha expirado).
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="bg-orange-500 hover:bg-orange-600 flex-1" disabled={loading}>
              {loading ? "Registrando..." : "Confirmar pago"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
