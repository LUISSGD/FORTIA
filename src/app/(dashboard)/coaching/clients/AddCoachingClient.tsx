"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { UserPlus } from "lucide-react"
import { GOALS, LEVELS } from "@/lib/coaching/constants"
import { Btn, Field, Input, Modal, Select, api } from "@/components/coaching/kit"

type GymClient = { id: string; firstName: string; lastName: string; phone: string | null }

const EMPTY = {
  firstName: "", lastName: "", phone: "", email: "", birthDate: "",
  goal: GOALS[0], level: "INTERMEDIO", sex: "M", heightCm: "", startWeight: "", targetWeight: "",
  trainingDays: "4", planName: "Coaching Premium", price: "600", billingDay: "1",
  accessEmail: "", accessPassword: "",
}

export default function AddCoachingClient({ gymClients }: { gymClients: GymClient[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"existing" | "new">(gymClients.length ? "existing" : "new")
  const [search, setSearch] = useState("")
  const [clientId, setClientId] = useState("")
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return gymClients.filter((c) => `${c.firstName} ${c.lastName} ${c.phone ?? ""}`.toLowerCase().includes(q)).slice(0, 50)
  }, [search, gymClients])

  async function save() {
    if (mode === "existing" && !clientId) return toast.error("Selecciona un cliente")
    setSaving(true)
    try {
      const profile = await api<{ clientId: string }>("/api/coaching/clients", "POST", { ...form, clientId: mode === "existing" ? clientId : null })
      if (form.accessEmail && form.accessPassword) {
        await api(`/api/coaching/clients/${profile.clientId}/access`, "POST", { email: form.accessEmail, password: form.accessPassword })
      }
      toast.success("Cliente agregado al coaching")
      setOpen(false)
      setForm(EMPTY)
      setClientId("")
      router.push(`/coaching/clients/${profile.clientId}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Btn onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" /> Agregar cliente
      </Btn>
      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo cliente de coaching" wide>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Btn variant={mode === "existing" ? "dark" : "outline"} size="sm" onClick={() => setMode("existing")}>Cliente del gimnasio</Btn>
            <Btn variant={mode === "new" ? "dark" : "outline"} size="sm" onClick={() => setMode("new")}>Cliente nuevo</Btn>
          </div>

          {mode === "existing" ? (
            <div className="space-y-2">
              <Input placeholder="Buscar por nombre o teléfono…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setClientId(c.id)}
                    className={`w-full text-left px-3 py-2 text-sm ${clientId === c.id ? "bg-orange-50 text-orange-700 font-medium" : "hover:bg-gray-50"}`}
                  >
                    {c.firstName} {c.lastName} {c.phone && <span className="text-gray-400 text-xs">· {c.phone}</span>}
                  </button>
                ))}
                {!filtered.length && <p className="text-sm text-gray-500 p-3">Sin resultados</p>}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre *"><Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field>
              <Field label="Apellido *"><Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
              <Field label="Teléfono"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="Fecha de nacimiento"><Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></Field>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Objetivo" className="col-span-2">
              <Select value={form.goal} onChange={(e) => set("goal", e.target.value)}>
                {GOALS.map((g) => <option key={g}>{g}</option>)}
              </Select>
            </Field>
            <Field label="Nivel">
              <Select value={form.level} onChange={(e) => set("level", e.target.value)}>
                {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Sexo">
              <Select value={form.sex} onChange={(e) => set("sex", e.target.value)}>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </Select>
            </Field>
            <Field label="Altura (cm)"><Input type="number" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} /></Field>
            <Field label="Peso inicial (kg)"><Input type="number" step="0.1" value={form.startWeight} onChange={(e) => set("startWeight", e.target.value)} /></Field>
            <Field label="Peso objetivo (kg)"><Input type="number" step="0.1" value={form.targetWeight} onChange={(e) => set("targetWeight", e.target.value)} /></Field>
            <Field label="Días de entreno/sem"><Input type="number" min={1} max={7} value={form.trainingDays} onChange={(e) => set("trainingDays", e.target.value)} /></Field>
            <Field label="Plan" className="col-span-2"><Input value={form.planName} onChange={(e) => set("planName", e.target.value)} /></Field>
            <Field label="Precio mensual (S/)"><Input type="number" value={form.price} onChange={(e) => set("price", e.target.value)} /></Field>
            <Field label="Día de cobro"><Input type="number" min={1} max={28} value={form.billingDay} onChange={(e) => set("billingDay", e.target.value)} /></Field>
          </div>

          <div className="rounded-lg bg-gray-50 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Acceso a la app (opcional, puedes crearlo después)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email de acceso"><Input type="email" value={form.accessEmail} onChange={(e) => set("accessEmail", e.target.value)} /></Field>
              <Field label="Contraseña (mín. 6)"><Input value={form.accessPassword} onChange={(e) => set("accessPassword", e.target.value)} /></Field>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setOpen(false)}>Cancelar</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? "Guardando…" : "Agregar"}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
