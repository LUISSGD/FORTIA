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
import { ArrowLeft, Dumbbell } from "lucide-react"

type Client = {
  id: string
  clientId: string | null
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  dni: string | null
  birthDate: string
  gender: string | null
  occupation: string | null
  physicalActivityLevel: string | null
  medicalConditions: string | null
  allergies: string | null
  foodPreferences: string | null
  currentGoal: string | null
  referredBy: string | null
  notes: string | null
  isActive: boolean
}

export default function NutritionEditForm({ client }: { client: Client }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email ?? "",
    phone: client.phone ?? "",
    dni: client.dni ?? "",
    birthDate: client.birthDate,
    gender: client.gender ?? "",
    occupation: client.occupation ?? "",
    physicalActivityLevel: client.physicalActivityLevel ?? "",
    medicalConditions: client.medicalConditions ?? "",
    allergies: client.allergies ?? "",
    foodPreferences: client.foodPreferences ?? "",
    currentGoal: client.currentGoal ?? "",
    referredBy: client.referredBy ?? "",
    notes: client.notes ?? "",
    isActive: client.isActive,
  })

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch(`/api/nutrition/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) {
      toast.success("Perfil actualizado")
      router.push(`/nutrition/${client.id}`)
    } else {
      toast.error("Error al actualizar")
    }
  }

  return (
    <main className="flex-1 p-3 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/nutrition/${client.id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-xl font-semibold">Editar paciente</h1>
        {client.clientId && (
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
            <Dumbbell className="h-3 w-3" />
            Alumno Fortia
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
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
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
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

        <Card>
          <CardHeader><CardTitle className="text-base">Perfil nutricional</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Objetivo</Label>
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
                <Label>Nivel de actividad</Label>
                <Select value={form.physicalActivityLevel} onValueChange={(v) => set("physicalActivityLevel", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEDENTARIO">Sedentario</SelectItem>
                    <SelectItem value="LIGERO">Ligero</SelectItem>
                    <SelectItem value="MODERADO">Moderado</SelectItem>
                    <SelectItem value="ACTIVO">Activo</SelectItem>
                    <SelectItem value="MUY_ACTIVO">Muy activo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Condiciones médicas</Label>
              <textarea
                value={form.medicalConditions}
                onChange={(e) => set("medicalConditions", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                rows={2}
              />
            </div>
            <div>
              <Label>Alergias / Intolerancias</Label>
              <Input value={form.allergies} onChange={(e) => set("allergies", e.target.value)} />
            </div>
            <div>
              <Label>Preferencias alimentarias</Label>
              <Input value={form.foodPreferences} onChange={(e) => set("foodPreferences", e.target.value)} />
            </div>
            <div>
              <Label>Referido por</Label>
              <Input value={form.referredBy} onChange={(e) => set("referredBy", e.target.value)} />
            </div>
            <div>
              <Label>Notas</Label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                rows={2}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => set("isActive", e.target.checked)}
                  className="h-4 w-4 rounded accent-green-600"
                />
                <span className="text-sm text-gray-700">Paciente activo</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pb-6">
          <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={loading}>
            {loading ? "Guardando..." : "Guardar cambios"}
          </Button>
          <Link href={`/nutrition/${client.id}`}><Button type="button" variant="outline">Cancelar</Button></Link>
        </div>
      </form>
    </main>
  )
}
