"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Mail, MessageCircle, Pencil, Phone, Sparkles, Trash2, UserPlus } from "lucide-react"
import { cn, whatsappUrl } from "@/lib/utils"
import { TRAINERS, trainerStyle } from "@/lib/trainers"
import { Btn, Field, Input, Modal, Select, Textarea, api } from "@/components/coaching/kit"
import type { Trial } from "@/lib/coaching/trials"

const STATUS: Record<string, { label: string; cls: string }> = {
  SCHEDULED: { label: "Agendada", cls: "bg-amber-100 text-amber-800" },
  ATTENDED: { label: "✅ Asistió", cls: "bg-emerald-100 text-emerald-800" },
  NO_SHOW: { label: "❌ No vino", cls: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Cancelada", cls: "bg-gray-100 text-gray-600" },
}
const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
const dayLabel = (ymd: string) => `${DAYS[new Date(`${ymd}T12:00:00Z`).getUTCDay()]} ${ymd.slice(8)}/${ymd.slice(5, 7)}`
const fullName = (t: Pick<Trial, "firstName" | "lastName">) => [t.firstName, t.lastName].filter(Boolean).join(" ")

/** Tarjeta de la clase de prueba dentro de un día de la agenda. */
export function TrialChip({ trial, onClick }: { trial: Trial; onClick: () => void }) {
  return (
    <button onClick={onClick} title="Clase de prueba" className="w-full text-left rounded-lg px-2 py-1.5 text-xs border border-dashed border-amber-400 bg-amber-50 hover:border-amber-500 block">
      <div className="flex items-center gap-1 font-semibold text-amber-800">
        <Sparkles className="h-3 w-3 shrink-0" />{trial.startTime} · Prueba
      </div>
      <p className="truncate text-gray-900">{trial.status === "ATTENDED" ? "✅ " : trial.status === "NO_SHOW" ? "❌ " : ""}{trial.firstName}</p>
      {trial.trainer && <p className={cn("text-[10px]", trainerStyle(trial.trainer).sub)}>{trial.trainer}</p>}
    </button>
  )
}

const EMPTY = { firstName: "", lastName: "", phone: "", email: "", dni: "", goal: "", notes: "", date: "", startTime: "", durationMin: "60", trainer: "" }

/**
 * Ventanas de la clase de prueba: formulario (nueva / editar) y detalle (estado, WhatsApp, convertir en cliente).
 * - `form`: null cerrado; { date } para una nueva; { trial } para editar.
 * - `canConvert`: solo el admin crea clientes.
 */
export function TrialModals({ form, onCloseForm, detail, onCloseDetail, onEdit, canConvert }: {
  form: { date?: string; trial?: Trial } | null
  onCloseForm: () => void
  detail: Trial | null
  onCloseDetail: () => void
  onEdit: (t: Trial) => void
  canConvert: boolean
}) {
  const router = useRouter()
  const [f, setF] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof EMPTY, v: string) => setF((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    if (!form) return
    const t = form.trial
    setF(t ? { firstName: t.firstName, lastName: t.lastName ?? "", phone: t.phone ?? "", email: t.email ?? "", dni: t.dni ?? "", goal: t.goal ?? "", notes: t.notes ?? "", date: t.date, startTime: t.startTime, durationMin: String(t.durationMin), trainer: t.trainer ?? "" } : { ...EMPTY, date: form.date ?? "" })
  }, [form])

  async function save() {
    setSaving(true)
    try {
      if (form?.trial) await api(`/api/trainer/trials/${form.trial.id}`, "PATCH", f)
      else await api("/api/trainer/trials", "POST", f)
      toast.success(form?.trial ? "Clase de prueba actualizada" : "Clase de prueba agendada 🎯")
      onCloseForm()
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function run(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn()
      toast.success(msg)
      onCloseDetail()
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function convert(t: Trial) {
    try {
      const r = await api<{ clientId: string }>(`/api/coaching/trials/${t.id}/convert`, "POST")
      toast.success(`${t.firstName} ya es cliente de FORTIA`)
      router.push(`/coaching/clients/${r.clientId}?tab=membership`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const confirmMsg = (t: Trial) =>
    `Hola ${t.firstName}, te confirmamos tu clase de prueba en FORTIA el ${dayLabel(t.date)} a las ${t.startTime}${t.trainer ? ` con ${t.trainer}` : ""}. ¡Te esperamos! 💪`

  return (
    <>
      <Modal open={!!form} onClose={onCloseForm} title={form?.trial ? "Editar clase de prueba" : "Nueva clase de prueba"}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre *"><Input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} autoFocus /></Field>
            <Field label="Apellidos"><Input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
            <Field label="Teléfono / WhatsApp"><Input inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="9XX XXX XXX" /></Field>
            <Field label="DNI"><Input inputMode="numeric" value={f.dni} onChange={(e) => set("dni", e.target.value)} /></Field>
            <Field label="Correo" className="col-span-2"><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Día *"><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
            <Field label="Hora *"><Input type="time" value={f.startTime} onChange={(e) => set("startTime", e.target.value)} /></Field>
            <Field label="Duración (min)"><Input type="number" min={15} step={15} value={f.durationMin} onChange={(e) => set("durationMin", e.target.value)} /></Field>
          </div>
          <Field label="Entrenador">
            <Select value={f.trainer} onChange={(e) => set("trainer", e.target.value)}>
              <option value="">Sin asignar</option>
              {TRAINERS.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Objetivo"><Input value={f.goal} onChange={(e) => set("goal", e.target.value)} placeholder="Bajar de peso, ganar fuerza, volver a entrenar…" /></Field>
          <Field label="Notas" hint="Lesiones, cómo nos conoció, disponibilidad…"><Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          <Btn className="w-full" disabled={saving} onClick={save}>{saving ? "Guardando…" : form?.trial ? "Guardar cambios" : "Agendar clase de prueba"}</Btn>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={onCloseDetail} title={detail ? `🎯 Clase de prueba · ${fullName(detail)}` : ""}>
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-gray-900 capitalize">{dayLabel(detail.date)} · {detail.startTime} ({detail.durationMin} min)</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS[detail.status]?.cls)}>{STATUS[detail.status]?.label}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", trainerStyle(detail.trainer).pill)}>{detail.trainer ?? "Sin entrenador"}</span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              {detail.phone && <><dt className="text-gray-500 flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Teléfono</dt><dd>{detail.phone}</dd></>}
              {detail.email && <><dt className="text-gray-500 flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Correo</dt><dd className="truncate">{detail.email}</dd></>}
              {detail.dni && <><dt className="text-gray-500">DNI</dt><dd>{detail.dni}</dd></>}
              {detail.goal && <><dt className="text-gray-500">Objetivo</dt><dd>{detail.goal}</dd></>}
              {detail.notes && <><dt className="text-gray-500">Notas</dt><dd className="whitespace-pre-wrap">{detail.notes}</dd></>}
              {detail.createdByName && <><dt className="text-gray-400 text-xs">Agendó</dt><dd className="text-gray-400 text-xs">{detail.createdByName}</dd></>}
            </dl>

            {detail.phone && (
              <a href={whatsappUrl(detail.phone, confirmMsg(detail))} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white font-semibold h-10 text-sm">
                <MessageCircle className="h-4 w-4" /> Confirmar por WhatsApp
              </a>
            )}

            <div className="grid grid-cols-2 gap-2">
              {detail.status !== "ATTENDED" && <Btn variant="outline" onClick={() => run(() => api(`/api/trainer/trials/${detail.id}`, "PATCH", { status: "ATTENDED" }), "Marcada: asistió ✅")}>✅ Asistió</Btn>}
              {detail.status !== "NO_SHOW" && <Btn variant="outline" onClick={() => run(() => api(`/api/trainer/trials/${detail.id}`, "PATCH", { status: "NO_SHOW" }), "Marcada: no vino")}>❌ No vino</Btn>}
              {detail.status !== "SCHEDULED" && <Btn variant="ghost" onClick={() => run(() => api(`/api/trainer/trials/${detail.id}`, "PATCH", { status: "SCHEDULED" }), "Marcado deshecho")}>Deshacer</Btn>}
              <Btn variant="ghost" onClick={() => onEdit(detail)}><Pencil className="h-4 w-4" /> Editar</Btn>
            </div>

            {canConvert && (
              detail.clientId ? (
                <Btn variant="outline" className="w-full" onClick={() => router.push(`/coaching/clients/${detail.clientId}`)}>Ver su ficha de cliente →</Btn>
              ) : (
                <Btn className="w-full" onClick={() => convert(detail)}><UserPlus className="h-4 w-4" /> Convertir en cliente</Btn>
              )
            )}

            <div className="flex gap-2 pt-1 border-t border-gray-100">
              <Btn variant="ghost" size="sm" className="flex-1" onClick={() => { if (confirm("¿Cancelar esta clase de prueba? Dejará de verse en la agenda.")) run(() => api(`/api/trainer/trials/${detail.id}`, "PATCH", { status: "CANCELLED" }), "Clase de prueba cancelada") }}>Cancelar clase</Btn>
              <Btn variant="danger" size="sm" onClick={() => { if (confirm("¿Eliminar esta clase de prueba? Se borrarán sus datos.")) run(() => api(`/api/trainer/trials/${detail.id}`, "DELETE"), "Clase de prueba eliminada") }}><Trash2 className="h-4 w-4" /></Btn>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
