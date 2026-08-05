"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface Plan { id: string; name: string; price: number }
interface Client {
  id: string; firstName: string; lastName: string; email?: string | null
  phone?: string | null; dni?: string | null; notes?: string | null
  trainer?: string | null; membershipPlanId?: string | null
  membershipStart?: string | null; membershipEnd?: string | null
  firstName2?: string | null; lastName2?: string | null
  phone2?: string | null; dni2?: string | null
  membershipPlan?: Plan | null
}

export default function EditClientPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [loading, setLoading] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [inactivePlan, setInactivePlan] = useState<Plan | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([
      fetch(`/api/clients/${params.id}`).then((r) => r.json()),
      fetch("/api/memberships").then((r) => r.json()),
    ]).then(([client, activePlans]: [Client, Plan[]]) => {
      setForm({
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email ?? "",
        phone: client.phone ?? "",
        dni: client.dni ?? "",
        notes: client.notes ?? "",
        trainer: client.trainer ?? "",
        membershipPlanId: client.membershipPlanId ?? "",
        membershipStart: client.membershipStart ? client.membershipStart.slice(0, 10) : "",
        membershipEnd: client.membershipEnd ? client.membershipEnd.slice(0, 10) : "",
        firstName2: client.firstName2 ?? "",
        lastName2: client.lastName2 ?? "",
        phone2: client.phone2 ?? "",
        dni2: client.dni2 ?? "",
      })
      // Separate active plans from the client's current plan (which may be inactive)
      const planInList = activePlans.find((p) => p.id === client.membershipPlanId)
      if (!planInList && client.membershipPlan) {
        setInactivePlan(client.membershipPlan)
      }
      setPlans(activePlans)
    })
  }, [params.id])

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch(`/api/clients/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) {
      toast.success("Cliente actualizado")
      router.push(`/clients/${params.id}`)
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "Error al actualizar")
    }
  }

  if (!form.firstName) return <div className="p-6">Cargando...</div>

  return (
    <main className="flex-1 p-3 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/clients/${params.id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-xl font-semibold">Editar cliente</h1>
      </div>
      <Card className="max-w-lg">
        <CardHeader><CardTitle>Datos del cliente</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <Label>Plan</Label>
              <Select value={form.membershipPlanId} onValueChange={(v) => set("membershipPlanId", v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar plan..." />
                </SelectTrigger>
                <SelectContent className="w-[480px] max-h-80">
                  {(() => {
                    const GROUPS = ["Fortia X", "Prime Athlete", "Elite Athlete Parejas", "Elite Athlete"]
                    const grouped = GROUPS.flatMap((group) => {
                      const gp = plans.filter((p) => p.name.toLowerCase().startsWith(group.toLowerCase()))
                      return gp.length ? [{ label: group, items: gp }] : []
                    })
                    const assignedIds = new Set(grouped.flatMap((g) => g.items.map((p) => p.id)))
                    const others = plans.filter((p) => !assignedIds.has(p.id))
                    if (others.length) grouped.push({ label: "Otros planes", items: others })

                    return (
                      <>
                        {inactivePlan && (
                          <SelectGroup>
                            <SelectLabel className="text-gray-400 font-semibold">Plan actual (inactivo)</SelectLabel>
                            <SelectItem value={inactivePlan.id} className="pl-4 text-gray-500 italic">
                              {inactivePlan.name} — S/ {inactivePlan.price}
                            </SelectItem>
                          </SelectGroup>
                        )}
                        {grouped.map(({ label, items }) => (
                          <SelectGroup key={label}>
                            <SelectLabel className="text-orange-600 font-semibold">{label}</SelectLabel>
                            {items.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="pl-4">
                                {p.name} — S/ {p.price}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </>
                    )
                  })()}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Inicio de membresía</Label>
                <Input type="date" value={form.membershipStart} onChange={(e) => set("membershipStart", e.target.value)} />
              </div>
              <div>
                <Label>Vencimiento de membresía</Label>
                <Input type="date" value={form.membershipEnd} onChange={(e) => set("membershipEnd", e.target.value)} />
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Persona 2 (pareja / grupo)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre</Label>
                  <Input value={form.firstName2} onChange={(e) => set("firstName2", e.target.value)} placeholder="Opcional" />
                </div>
                <div>
                  <Label>Apellido</Label>
                  <Input value={form.lastName2} onChange={(e) => set("lastName2", e.target.value)} placeholder="Opcional" />
                </div>
                <div>
                  <Label>DNI</Label>
                  <Input value={form.dni2} onChange={(e) => set("dni2", e.target.value)} />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input value={form.phone2} onChange={(e) => set("phone2", e.target.value)} />
                </div>
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600" disabled={loading}>
                {loading ? "Guardando..." : "Guardar cambios"}
              </Button>
              <Link href={`/clients/${params.id}`}><Button type="button" variant="outline">Cancelar</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
