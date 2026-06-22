"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { INCOME_CATEGORIES } from "@/lib/utils"
import { format } from "date-fns"

export default function NewIncomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    amount: "", currency: "PEN", category: "OTHER", description: "", date: format(new Date(), "yyyy-MM-dd"),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/finances/income", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) {
      toast.success("Ingreso registrado")
      router.push("/finances/income")
    } else {
      toast.error("Error al registrar")
    }
  }

  const symbol = form.currency === "USD" ? "$" : "S/"

  return (
    <main className="flex-1 p-3 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/finances/income"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-xl font-semibold">Registrar ingreso</h1>
      </div>
      <Card className="max-w-md">
        <CardHeader><CardTitle>Datos del ingreso</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Moneda</Label>
              <div className="flex gap-2 mt-1">
                {["PEN", "USD"].map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setForm({ ...form, currency: cur })}
                    className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors ${form.currency === cur ? "bg-green-500 text-white border-green-500" : "border-gray-300 text-gray-600 hover:border-green-400"}`}
                  >
                    {cur === "PEN" ? "S/ Soles" : "$ Dólares"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Monto ({symbol}) *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required min="0.01" placeholder="0.00" />
            </div>
            <div>
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v ?? form.category })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INCOME_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalle del ingreso..." />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="bg-green-500 hover:bg-green-600" disabled={loading}>
                {loading ? "Guardando..." : "Registrar ingreso"}
              </Button>
              <Link href="/finances/income"><Button type="button" variant="outline">Cancelar</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
