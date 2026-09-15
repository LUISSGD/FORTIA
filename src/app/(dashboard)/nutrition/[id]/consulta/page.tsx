"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function NewConsultationPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string
  const [loading, setLoading] = useState(false)

  const today = new Date().toISOString().split("T")[0]

  const [form, setForm] = useState({
    date: today,
    // Measurements
    weight: "", height: "", bodyFat: "", muscleMass: "",
    visceralFat: "", waist: "", hips: "", arms: "",
    // Nutrition
    goal: "", calTarget: "", proteinTarget: "", carbsTarget: "",
    fatTarget: "", waterTarget: "",
    // Plan
    dietPlan: "", supplements: "", recommendations: "", observations: "",
    // Next
    nextAppointment: "",
    // Payment
    isPaid: false, paymentAmount: "", paymentMethod: "",
  })

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch(`/api/nutrition/clients/${clientId}/consultations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) {
      toast.success("Consulta registrada")
      router.push(`/nutrition/${clientId}`)
    } else {
      toast.error("Error al registrar consulta")
    }
  }

  return (
    <main className="flex-1 p-3 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/nutrition/${clientId}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-xl font-semibold">Nueva consulta</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        {/* Fecha */}
        <Card>
          <CardContent className="pt-5">
            <div className="max-w-xs">
              <Label>Fecha de consulta *</Label>
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
            </div>
          </CardContent>
        </Card>

        {/* Medidas antropométricas */}
        <Card>
          <CardHeader><CardTitle className="text-base">Medidas antropométricas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Peso (kg)</Label>
                <Input type="number" step="0.1" value={form.weight} onChange={(e) => set("weight", e.target.value)} placeholder="0.0" />
              </div>
              <div>
                <Label>Talla (cm)</Label>
                <Input type="number" step="0.1" value={form.height} onChange={(e) => set("height", e.target.value)} placeholder="0.0" />
              </div>
              <div>
                <Label>% Grasa corporal</Label>
                <Input type="number" step="0.1" value={form.bodyFat} onChange={(e) => set("bodyFat", e.target.value)} placeholder="0.0" />
              </div>
              <div>
                <Label>Masa muscular (kg)</Label>
                <Input type="number" step="0.1" value={form.muscleMass} onChange={(e) => set("muscleMass", e.target.value)} placeholder="0.0" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Grasa visceral</Label>
                <Input type="number" value={form.visceralFat} onChange={(e) => set("visceralFat", e.target.value)} placeholder="1–15" />
              </div>
              <div>
                <Label>Cintura (cm)</Label>
                <Input type="number" step="0.1" value={form.waist} onChange={(e) => set("waist", e.target.value)} placeholder="0.0" />
              </div>
              <div>
                <Label>Cadera (cm)</Label>
                <Input type="number" step="0.1" value={form.hips} onChange={(e) => set("hips", e.target.value)} placeholder="0.0" />
              </div>
              <div>
                <Label>Brazos (cm)</Label>
                <Input type="number" step="0.1" value={form.arms} onChange={(e) => set("arms", e.target.value)} placeholder="0.0" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Objetivos nutricionales */}
        <Card>
          <CardHeader><CardTitle className="text-base">Objetivos nutricionales</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Objetivo</Label>
              <Select value={form.goal} onValueChange={(v) => set("goal", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar objetivo..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERDIDA_PESO">Pérdida de peso</SelectItem>
                  <SelectItem value="GANANCIA_MUSCULAR">Ganancia muscular</SelectItem>
                  <SelectItem value="MANTENIMIENTO">Mantenimiento</SelectItem>
                  <SelectItem value="DEFINICION">Definición</SelectItem>
                  <SelectItem value="SALUD">Salud general</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <Label>Calorías (kcal)</Label>
                <Input type="number" value={form.calTarget} onChange={(e) => set("calTarget", e.target.value)} placeholder="2000" />
              </div>
              <div>
                <Label>Proteína (g)</Label>
                <Input type="number" step="0.1" value={form.proteinTarget} onChange={(e) => set("proteinTarget", e.target.value)} placeholder="150" />
              </div>
              <div>
                <Label>Carbohidratos (g)</Label>
                <Input type="number" step="0.1" value={form.carbsTarget} onChange={(e) => set("carbsTarget", e.target.value)} placeholder="200" />
              </div>
              <div>
                <Label>Grasas (g)</Label>
                <Input type="number" step="0.1" value={form.fatTarget} onChange={(e) => set("fatTarget", e.target.value)} placeholder="60" />
              </div>
              <div>
                <Label>Agua (L)</Label>
                <Input type="number" step="0.1" value={form.waterTarget} onChange={(e) => set("waterTarget", e.target.value)} placeholder="2.0" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan de alimentación */}
        <Card>
          <CardHeader><CardTitle className="text-base">Plan de alimentación</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Plan de alimentación</Label>
              <textarea
                value={form.dietPlan}
                onChange={(e) => set("dietPlan", e.target.value)}
                placeholder="Desayuno: ...&#10;Media mañana: ...&#10;Almuerzo: ...&#10;Media tarde: ...&#10;Cena: ..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none font-mono"
                rows={8}
              />
            </div>
            <div>
              <Label>Suplementación</Label>
              <textarea
                value={form.supplements}
                onChange={(e) => set("supplements", e.target.value)}
                placeholder="Proteína whey, creatina, vitamina D3..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Recomendaciones</Label>
                <textarea
                  value={form.recommendations}
                  onChange={(e) => set("recommendations", e.target.value)}
                  placeholder="Hábitos, hidratación, sueño..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                  rows={3}
                />
              </div>
              <div>
                <Label>Observaciones de la nutricionista</Label>
                <textarea
                  value={form.observations}
                  onChange={(e) => set("observations", e.target.value)}
                  placeholder="Adherencia al plan anterior, cambios, motivación..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Próxima cita + pago */}
        <Card>
          <CardHeader><CardTitle className="text-base">Próxima cita y pago</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Fecha de próxima cita</Label>
              <Input type="date" value={form.nextAppointment} onChange={(e) => set("nextAppointment", e.target.value)} className="max-w-xs" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Monto cobrado (S/)</Label>
                <Input type="number" step="0.01" value={form.paymentAmount} onChange={(e) => set("paymentAmount", e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label>Método de pago</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => set("paymentMethod", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                    <SelectItem value="TARJETA">Tarjeta</SelectItem>
                    <SelectItem value="YAPE">Yape / Plin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPaid}
                    onChange={(e) => set("isPaid", e.target.checked)}
                    className="h-4 w-4 rounded accent-green-600"
                  />
                  <span className="text-sm text-gray-700">Pago recibido</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pb-6">
          <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={loading}>
            {loading ? "Guardando..." : "Guardar consulta"}
          </Button>
          <Link href={`/nutrition/${clientId}`}><Button type="button" variant="outline">Cancelar</Button></Link>
        </div>
      </form>
    </main>
  )
}
