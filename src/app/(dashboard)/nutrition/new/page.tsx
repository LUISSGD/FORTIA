"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import Link from "next/link"
import { ArrowLeft, Search, X, Dumbbell } from "lucide-react"

type GymClient = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  dni: string | null
  birthDate: string | null
}

export default function NewNutritionClientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [linkedClientId, setLinkedClientId] = useState<string | null>(null)
  const [linkedClientName, setLinkedClientName] = useState("")

  // Gym client search
  const [gymSearch, setGymSearch] = useState("")
  const [gymResults, setGymResults] = useState<GymClient[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", dni: "",
    birthDate: "", gender: "", occupation: "",
    physicalActivityLevel: "", medicalConditions: "", allergies: "",
    foodPreferences: "", currentGoal: "", referredBy: "", notes: "",
  })

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleGymSearch(q: string) {
    setGymSearch(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) { setGymResults([]); setShowResults(false); return }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/nutrition/gym-clients?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setGymResults(data)
        setShowResults(true)
      }
    }, 300)
  }

  function selectGymClient(c: GymClient) {
    setLinkedClientId(c.id)
    setLinkedClientName(`${c.firstName} ${c.lastName}`)
    setGymSearch("")
    setShowResults(false)
    setForm((f) => ({
      ...f,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email ?? "",
      phone: c.phone ?? "",
      dni: c.dni ?? "",
      birthDate: c.birthDate ? c.birthDate.split("T")[0] : "",
    }))
    toast.success(`Datos de ${c.firstName} ${c.lastName} pre-cargados`)
  }

  function clearLinkedClient() {
    setLinkedClientId(null)
    setLinkedClientName("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/nutrition/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, clientId: linkedClientId }),
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

      {/* Gym client linker */}
      <Card className="mb-5 border-green-200 bg-green-50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell className="h-4 w-4 text-green-700" />
            <span className="text-sm font-medium text-green-800">¿Es alumno de Fortia?</span>
            <span className="text-xs text-green-600">Busca para pre-cargar sus datos</span>
          </div>

          {linkedClientId ? (
            <div className="flex items-center gap-3 bg-white border border-green-300 rounded-lg px-3 py-2">
              <div className="h-7 w-7 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">
                {linkedClientName.charAt(0)}
              </div>
              <span className="text-sm font-medium text-gray-800 flex-1">{linkedClientName}</span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Alumno Fortia</span>
              <button type="button" onClick={clearLinkedClient} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={gymSearch}
                  onChange={(e) => handleGymSearch(e.target.value)}
                  onFocus={() => gymResults.length > 0 && setShowResults(true)}
                  placeholder="Buscar por nombre, DNI o teléfono..."
                  className="pl-9 bg-white"
                />
              </div>
              {showResults && gymResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                  {gymResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-4 py-2.5 hover:bg-green-50 flex items-center gap-3 border-b last:border-0"
                      onMouseDown={() => selectGymClient(c)}
                    >
                      <div className="h-7 w-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {c.firstName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-gray-500">{[c.dni, c.phone].filter(Boolean).join(" · ")}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showResults && gymResults.length === 0 && gymSearch.length >= 2 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-500">
                  No se encontró ningún alumno con ese criterio
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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

        <div className="flex gap-3 pb-6">
          <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={loading}>
            {loading ? "Guardando..." : "Registrar paciente"}
          </Button>
          <Link href="/nutrition"><Button type="button" variant="outline">Cancelar</Button></Link>
        </div>
      </form>
    </main>
  )
}
