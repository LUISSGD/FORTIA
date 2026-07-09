"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import Link from "next/link"
import { ArrowLeft, Users } from "lucide-react"
interface Plan { id: string; name: string; price: number; durationDays: number }

const PLAN_GROUPS = ["FORTIA X", "PRIME ATHLETE Corporativo", "PRIME ATHLETE Atletas", "PRIME ATHLETE", "ELITE ATHLETE Head Coach", "ELITE ATHLETE Team Fortia", "FORTIA SOCIO"]

function groupPlans(plans: Plan[]) {
  const grouped = PLAN_GROUPS.flatMap((group) => {
    const items = plans.filter((p) => p.name.startsWith(group))
    return items.length ? [{ label: group, items }] : []
  })
  const assignedIds = new Set(grouped.flatMap((g) => g.items.map((p) => p.id)))
  const others = plans.filter((p) => !assignedIds.has(p.id))
  if (others.length) grouped.push({ label: "Otros", items: others })
  return grouped
}

export default function NewClientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [isCouple, setIsCouple] = useState(false)
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", dni: "",
    firstName2: "", lastName2: "", phone2: "", dni2: "",
    notes: "", membershipPlanId: "", trainer: "",
  })

  useEffect(() => {
    fetch("/api/memberships").then((r) => r.json()).then(setPlans)
  }, [])

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) {
      toast.success("Cliente registrado exitosamente")
      router.push("/clients")
    } else {
      toast.error("Error al registrar el cliente")
    }
  }

  return (
    <main className="flex-1 p-3 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clients">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-xl font-semibold">Nuevo cliente</h1>
      </div>
      <Card className="max-w-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Datos del cliente</CardTitle>
            <button
              type="button"
              onClick={() => setIsCouple(!isCouple)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${isCouple ? "bg-orange-500 text-white border-orange-500" : "border-gray-300 text-gray-600 hover:border-orange-400"}`}
            >
              <Users className="h-4 w-4" />
              {isCouple ? "Pareja ✓" : "Registrar como pareja"}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Persona 1 */}
            <div className={isCouple ? "p-3 bg-orange-50 rounded-lg border border-orange-100" : ""}>
              {isCouple && <p className="text-xs font-semibold text-orange-600 mb-3">PERSONA 1</p>}
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
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <Label>DNI</Label>
                  <Input value={form.dni} onChange={(e) => set("dni", e.target.value)} />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="9XXXXXXXX" />
                </div>
              </div>
            </div>

            {/* Persona 2 */}
            {isCouple && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs font-semibold text-blue-600 mb-3">PERSONA 2</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nombre *</Label>
                    <Input value={form.firstName2} onChange={(e) => set("firstName2", e.target.value)} required={isCouple} />
                  </div>
                  <div>
                    <Label>Apellido *</Label>
                    <Input value={form.lastName2} onChange={(e) => set("lastName2", e.target.value)} required={isCouple} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <Label>DNI</Label>
                    <Input value={form.dni2} onChange={(e) => set("dni2", e.target.value)} />
                  </div>
                  <div>
                    <Label>Teléfono</Label>
                    <Input value={form.phone2} onChange={(e) => set("phone2", e.target.value)} placeholder="9XXXXXXXX" />
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>

            <div>
              <Label>Plan de membresía</Label>
              <Select value={form.membershipPlanId} onValueChange={(v) => set("membershipPlanId", v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar plan..." />
                </SelectTrigger>
                <SelectContent className="w-[480px] max-h-80">
                  {groupPlans(plans).map(({ label, items }) => (
                    <SelectGroup key={label}>
                      <SelectLabel className="text-orange-600 font-semibold">{label}</SelectLabel>
                      {items.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="pl-4">
                          {p.name} — S/ {p.price}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Entrenador</Label>
              <Select value={form.trainer} onValueChange={(v) => set("trainer", v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin entrenador asignado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Piero">Piero</SelectItem>
                  <SelectItem value="Leonardo">Leonardo</SelectItem>
                  <SelectItem value="Juliuz">Juliuz</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notas</Label>
              <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Observaciones..." />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600" disabled={loading}>
                {loading ? "Guardando..." : "Registrar cliente"}
              </Button>
              <Link href="/clients"><Button type="button" variant="outline">Cancelar</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
