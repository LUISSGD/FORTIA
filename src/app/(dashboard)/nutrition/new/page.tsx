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

export default function NewNutritionClientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", dni: "",
    birthDate: "", gender: "", occupation: "",
    physicalActivityLevel: "", medicalConditions: "", allergies: "",
    foodPreferences: "", currentGoal: "", referredBy: "", notes: "",
  })

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/nutrition/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) {
      const data = await res.json()
      toast.success("Paciente registrado")
      router.push(`/nutrition/${data.id}`)
    } else {
      toast.error("Error al registrar paciente")
    }
  }

  return (
    <main className="flex-1 p-3 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/nutrition">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-xl font-semibold">Nuevo paciente</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        {/* Datos personales */}
        <Card>
          <CardHeader><CardTitle className="text-base">Datos personales</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
              </div>
              <div>
                <Label>Apellido *</Label>
                <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>DNI</Label>
                <Input value={form.dni} onChange={(e) => set("dni", e.target.value)} />
              </div>
              <div>
                <Label>Fecha de nacimiento</Label>
                <Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="9XXXXXXXX" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Género</Label>
                <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ocupación</Label>
                <Input value={form.occupation} onChange={(e) => set("occupation", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Perfil nutricional */}
        <Card>
          <CardHeader><CardTitle className="text-base">Perfil nutricional</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Objetivo principal</Label>
                <Select value={form.currentGoal} onValueChange={(v) => set("currentGoal", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERDIDA_PESO">Pérdida de peso</SelectItem>
                    <SelectItem value="GANANCIA_MUSCULAR">Ganancia muscular</SelectItem>
                    <SelectItem value="MANTENIMIENTO">Mantenimiento</SelectItem>
                    <SelectItem value="DEFINICION">Definición</SelectItem>
                    <SelectItem value="SALUD">Salud general</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nivel de actividad física</Label>
                <Select value={form.physicalActivityLevel} onValueChange={(v) => set("physicalActivityLevel", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEDENTARIO">Sedentario</SelectItem>
                    <SelectItem value="LIGERO">Ligero (1-2 días/semana)</SelectItem>
                    <SelectItem value="MODERADO">Moderado (3-4 días/semana)</SelectItem>
                    <SelectItem value="ACTIVO">Activo (5-6 días/semana)</SelectItem>
                    <SelectItem value="MUY_ACTIVO">Muy activo (diario)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Condiciones médicas / Enfermedades</Label>
              <textarea
                value={form.medicalConditions}
                onChange={(e) => set("medicalConditions", e.target.value)}
                placeholder="Diabetes, hipertensión, hipotiroidismo..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                rows={2}
              />
            </div>
            <div>
              <Label>Alergias / Intolerancias</Label>
              <Input
                value={form.allergies}
                onChange={(e) => set("allergies", e.target.value)}
                placeholder="Lactosa, gluten, mariscos..."
              />
            </div>
            <div>
              <Label>Preferencias / Restricciones alimentarias</Label>
              <Input
                value={form.foodPreferences}
                onChange={(e) => set("foodPreferences", e.target.value)}
                placeholder="Vegetariano, no consume cerdo, sin azúcar..."
              />
            </div>
            <div>
              <Label>Referido por</Label>
              <Input value={form.referredBy} onChange={(e) => set("referredBy", e.target.value)} />
            </div>
            <div>
              <Label>Notas adicionales</Label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={loading}>
            {loading ? "Guardando..." : "Registrar paciente"}
          </Button>
          <Link href="/nutrition"><Button type="button" variant="outline">Cancelar</Button></Link>
        </div>
      </form>
    </main>
  )
}
