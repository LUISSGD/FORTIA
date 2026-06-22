"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function EditMembershipPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [form, setForm] = useState({ name: "", durationDays: "", price: "", description: "" })

  useEffect(() => {
    fetch(`/api/memberships/${id}`)
      .then((r) => r.json())
      .then((plan) => {
        setForm({
          name: plan.name ?? "",
          durationDays: String(plan.durationDays ?? ""),
          price: String(plan.price ?? ""),
          description: plan.description ?? "",
        })
        setFetching(false)
      })
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch(`/api/memberships/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) {
      toast.success("Plan actualizado exitosamente")
      router.push("/memberships")
    } else {
      toast.error("Error al actualizar el plan")
    }
  }

  if (fetching) {
    return (
      <main className="flex-1 p-3 md:p-6">
        <p className="text-gray-500 text-sm">Cargando plan...</p>
      </main>
    )
  }

  return (
    <main className="flex-1 p-3 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/memberships">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-xl font-semibold">Editar plan de membresía</h1>
      </div>
      <Card className="max-w-md">
        <CardHeader><CardTitle>Datos del plan</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nombre del plan</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label>Duración (días)</Label>
              <Input type="number" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} required min="1" />
            </div>
            <div>
              <Label>Precio (S/)</Label>
              <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required min="0" />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción del plan..." />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600" disabled={loading}>
                {loading ? "Guardando..." : "Guardar cambios"}
              </Button>
              <Link href="/memberships"><Button type="button" variant="outline">Cancelar</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
