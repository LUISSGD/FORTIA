"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { format } from "date-fns"

export default function NewDebtPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: "", creditor: "", totalAmount: "", currency: "PEN",
    monthlyPayment: "", startDate: format(new Date(), "yyyy-MM-dd"),
    dueDate: "", notes: "",
  })

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/debts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) {
      toast.success("Deuda registrada")
      router.push("/debts")
    } else {
      toast.error("Error al registrar")
    }
  }

  return (
    <main className="flex-1 p-3 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/debts"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-xl font-semibold">Nueva deuda / préstamo</h1>
      </div>
      <Card className="max-w-md">
        <CardHeader><CardTitle>Datos del préstamo</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nombre / Descripción *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej: Préstamo banco BCP" required />
            </div>
            <div>
              <Label>Acreedor (banco o persona)</Label>
              <Input value={form.creditor} onChange={(e) => set("creditor", e.target.value)} placeholder="Ej: Banco BCP" />
            </div>
            <div>
              <Label>Moneda</Label>
              <div className="flex gap-2 mt-1">
                {["PEN", "USD"].map((cur) => (
                  <button key={cur} type="button" onClick={() => set("currency", cur)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors ${form.currency === cur ? "bg-orange-500 text-white border-orange-500" : "border-gray-300 text-gray-600 hover:border-orange-400"}`}>
                    {cur === "PEN" ? "S/ Soles" : "$ Dólares"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Monto total del préstamo *</Label>
              <Input type="number" step="0.01" min="0.01" value={form.totalAmount} onChange={(e) => set("totalAmount", e.target.value)} placeholder="0.00" required />
            </div>
            <div>
              <Label>Cuota mensual (opcional)</Label>
              <Input type="number" step="0.01" min="0" value={form.monthlyPayment} onChange={(e) => set("monthlyPayment", e.target.value)} placeholder="0.00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha inicio</Label>
                <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </div>
              <div>
                <Label>Fecha vencimiento</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Observaciones..." />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600" disabled={loading}>
                {loading ? "Guardando..." : "Registrar deuda"}
              </Button>
              <Link href="/debts"><Button type="button" variant="outline">Cancelar</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
