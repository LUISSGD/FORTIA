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
import { ArrowLeft } from "lucide-react"
import { format } from "date-fns"

interface Plan {
  id: string
  name: string
  price: number
  durationDays: number
}

export default function NewClientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", dni: "",
    notes: "", membershipPlanId: "", membershipStart: format(new Date(), "yyyy-MM-dd"),
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
    <main className="flex-1 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clients">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-xl font-semibold">Nuevo cliente</h1>
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
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="9XXXXXXXX" />
              </div>
            </div>
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
                  {["FORTIA X", "PRIME ATHLETE Corporativo", "PRIME ATHLETE Atletas", "PRIME ATHLETE", "ELITE ATHLETE Head Coach", "ELITE ATHLETE Team Fortia", "FORTIA SOCIO"].map((group) => {
                    const groupPlans = plans.filter((p) => p.name.startsWith(group))
                    if (!groupPlans.length) return null
                    return (
                      <SelectGroup key={group}>
                        <SelectLabel className="text-orange-600 font-semibold">{group}</SelectLabel>
                        {groupPlans.map((p) => {
                          const label = p.name.replace(group + " — ", "").replace(group, "").trim() || p.name
                          return (
                            <SelectItem key={p.id} value={p.id} textValue={`${group} ${label}`} className="pl-4">
                              {label} — S/ {p.price}
                            </SelectItem>
                          )
                        })}
                      </SelectGroup>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha de inicio</Label>
              <Input type="date" value={form.membershipStart} onChange={(e) => set("membershipStart", e.target.value)} />
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
