"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Plus, Trash2, Video, MapPin, Dumbbell } from "lucide-react"
import { BOOKING_STATUS } from "@/lib/coaching/constants"
import { DAYS_OF_WEEK } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Btn, Field, Input, Modal, Panel, Select, api } from "@/components/coaching/kit"
import { TRAINERS, UNASSIGNED_TRAINER, trainerStyle } from "@/lib/trainers"
import { TrialChip, TrialModals } from "@/components/coaching/trials/TrialModals"
import type { Trial } from "@/lib/coaching/trials"

type Booking = { id: string; status: string; clientId: string; name: string }
type Slot = { id: string; startsAt: string; endsAt: string; title: string; mode: string; capacity: number; location: string | null; bookings: Booking[] }
type TrainingSlot = { sessionId: string; sessionNumber: number; scheduledDate: string; clientId: string; clientName: string; startTime: string | null; endTime: string | null; attended: boolean | null; tipoEntrenador: string; modalidad: string; trainer: string | null }

const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d)
const hhmm = (iso: string) => new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
const addDays = (s: string, n: number) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

export default function AgendaClient({ week, slots, clients, trainingSlots = [], trials = [] }: { week: string; slots: Slot[]; clients: { id: string; name: string }[]; trainingSlots?: TrainingSlot[]; trials?: Trial[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<Slot | null>(null)
  const [form, setForm] = useState({ date: week, times: "09:00, 10:00, 11:00", durationMin: "60", repeatWeeks: "1", weekdays: [] as number[], capacity: "1", mode: "PRESENCIAL", title: "Sesión de entrenamiento", location: "" })
  const [bookClient, setBookClient] = useState("")
  const [trialForm, setTrialForm] = useState<{ date?: string; trial?: Trial } | null>(null)
  const [trialDetail, setTrialDetail] = useState<Trial | null>(null)
  const today = ymd(new Date())
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))

  async function create() {
    try {
      const r = await api<{ created: number }>("/api/coaching/slots", "POST", { ...form, times: form.times.split(/[,\s]+/).filter(Boolean) })
      toast.success(`${r.created} horarios creados`)
      setCreating(false)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function act(fn: () => Promise<unknown>, msg?: string) {
    try {
      await fn()
      if (msg) toast.success(msg)
      setDetail(null)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`?week=${addDays(week, -7)}`} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="h-4 w-4" /></Link>
          <h1 className="text-lg font-bold">Semana del {week.split("-").reverse().join("/")}</h1>
          <Link href={`?week=${addDays(week, 7)}`} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight className="h-4 w-4" /></Link>
          <Link href="/coaching/agenda" className="text-xs text-orange-600 ml-1">Hoy</Link>
        </div>
        <div className="flex gap-2">
          <Link href="/coaching/agenda/clases"><Btn variant="outline">📊 Clases del mes</Btn></Link>
          <Btn variant="outline" onClick={() => setTrialForm({ date: today >= week && today <= addDays(week, 6) ? today : week })}><Plus className="h-4 w-4" /> Clase de prueba</Btn>
          <Btn onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Crear horarios</Btn>
        </div>
      </div>

      {/* Leyenda: color de las clases personalizadas según su entrenador */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="font-medium text-gray-600">Clases EP:</span>
        {[...TRAINERS, UNASSIGNED_TRAINER].map((t) => (
          <span key={t.name} className="flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-full", t.dot)} />{t.name}</span>
        ))}
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-300" />Citas de coaching</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-dashed border-amber-500 bg-amber-100" />Clases de prueba</span>
      </div>

      <div className="grid md:grid-cols-7 gap-3">
        {days.map((d, i) => {
          const daySlots = slots.filter((s) => ymd(new Date(s.startsAt)) === d)
          const dayTraining = trainingSlots.filter((s) => s.scheduledDate === d)
          // Merge coaching slots + EP sessions sorted chronologically
          const dayTrials = trials.filter((t) => t.date === d)
          type Item = { key: string; time: string } & ({ kind: "coaching"; slot: typeof daySlots[0] } | { kind: "training"; session: typeof dayTraining[0] } | { kind: "trial"; trial: Trial })
          const merged: Item[] = [
            ...daySlots.map((s) => ({ key: s.id, kind: "coaching" as const, slot: s, time: hhmm(s.startsAt) })),
            ...dayTraining.map((s) => ({ key: s.sessionId, kind: "training" as const, session: s, time: s.startTime?.slice(0, 5) ?? "99:99" })),
            ...dayTrials.map((t) => ({ key: t.id, kind: "trial" as const, trial: t, time: t.startTime })),
          ].sort((a, b) => a.time.localeCompare(b.time))
          const isEmpty = merged.length === 0
          return (
            <Panel key={d} className={cn("p-3", d === today && "ring-2 ring-orange-300")}>
              <p className="text-xs font-semibold text-gray-500 uppercase">{DAYS_OF_WEEK[i].slice(0, 3)} <span className="text-gray-900">{d.slice(8)}</span></p>
              <div className="mt-2 space-y-1.5">
                {isEmpty && <p className="text-[11px] text-gray-300">—</p>}
                {merged.map((item) => {
                  if (item.kind === "trial") return <TrialChip key={item.key} trial={item.trial} onClick={() => setTrialDetail(item.trial)} />
                  if (item.kind === "coaching") {
                    const s = item.slot
                    const booked = s.bookings.filter((b) => ["BOOKED", "ATTENDED", "NO_SHOW"].includes(b.status))
                    const waiting = s.bookings.filter((b) => b.status === "WAITLIST").length
                    return (
                      <button key={item.key} onClick={() => { setDetail(s); setBookClient("") }} className={cn("w-full text-left rounded-lg px-2 py-1.5 text-xs border", booked.length ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-100 hover:border-gray-300")}>
                        <p className="font-semibold">{item.time} {s.mode === "ONLINE" && <Video className="inline h-3 w-3" />}</p>
                        {booked.length ? (
                          booked.map((b) => <p key={b.id} className="truncate">{b.status === "ATTENDED" ? "✅ " : b.status === "NO_SHOW" ? "❌ " : ""}{b.name.split(" ")[0]}</p>)
                        ) : (
                          <p className="text-gray-400">Libre</p>
                        )}
                        {s.capacity > 1 && <p className="text-[10px] text-gray-400">{booked.length}/{s.capacity}{waiting ? ` · ${waiting} en espera` : ""}</p>}
                      </button>
                    )
                  }
                  const s = item.session
                  const t = trainerStyle(s.trainer)
                  return (
                    <Link
                      key={item.key}
                      href={`/coaching/clients/${s.clientId}?tab=membership`}
                      title={`Entrenador: ${s.trainer ?? "sin asignar"}`}
                      className={cn("w-full text-left rounded-lg px-2 py-1.5 text-xs border block", t.card)}
                    >
                      <div className={cn("flex items-center gap-1 font-semibold", t.text)}>
                        <Dumbbell className="h-3 w-3 shrink-0" />
                        {item.time !== "99:99" ? item.time : "Sin hora"}
                      </div>
                      <p className="truncate text-gray-900">
                        {s.attended === true ? "✅ " : s.attended === false ? "❌ " : ""}{s.clientName.trim().split(" ")[0]}
                      </p>
                      <p className={cn("text-[10px]", t.sub)}>S{s.sessionNumber}{s.trainer ? ` · ${s.trainer}` : ""}</p>
                    </Link>
                  )
                })}
              </div>
            </Panel>
          )
        })}
      </div>

      <TrialModals
        form={trialForm}
        onCloseForm={() => setTrialForm(null)}
        detail={trialDetail}
        onCloseDetail={() => setTrialDetail(null)}
        onEdit={(t) => { setTrialDetail(null); setTrialForm({ trial: t }) }}
        canConvert
      />

      <Modal open={creating} onClose={() => setCreating(false)} title="Crear horarios disponibles">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Repetir (semanas)"><Input type="number" min={1} max={12} value={form.repeatWeeks} onChange={(e) => setForm({ ...form, repeatWeeks: e.target.value })} /></Field>
          </div>
          <Field label="Días de la semana" hint="Si no marcas ninguno, solo se crea en la fecha indicada.">
            <div className="flex flex-wrap gap-1">
              {DAYS_OF_WEEK.map((d, i) => (
                <button key={d} type="button" onClick={() => setForm((f) => ({ ...f, weekdays: f.weekdays.includes(i) ? f.weekdays.filter((x) => x !== i) : [...f.weekdays, i] }))} className={cn("px-2.5 py-1 rounded-full text-xs", form.weekdays.includes(i) ? "bg-gray-900 text-white" : "bg-gray-100")}>
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Horas (separadas por coma)"><Input value={form.times} onChange={(e) => setForm({ ...form, times: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Duración (min)"><Input type="number" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} /></Field>
            <Field label="Cupos"><Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
            <Field label="Modalidad">
              <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}><option value="PRESENCIAL">Presencial</option><option value="ONLINE">Online</option></Select>
            </Field>
          </div>
          <Field label="Título"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label={form.mode === "ONLINE" ? "Enlace de videollamada" : "Lugar"}><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <Btn className="w-full" onClick={create}>Crear</Btn>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.title} · ${hhmm(detail.startsAt)}–${hhmm(detail.endsAt)}` : ""}>
        {detail && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 flex items-center gap-1">
              {detail.mode === "ONLINE" ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
              {detail.mode === "ONLINE" ? "Online" : "Presencial"}{detail.location ? ` · ${detail.location}` : ""} · {detail.capacity} cupo(s)
            </p>
            <ul className="divide-y border rounded-lg">
              {detail.bookings.length === 0 && <li className="p-3 text-sm text-gray-500">Sin reservas.</li>}
              {detail.bookings.map((b) => (
                <li key={b.id} className="p-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-gray-500">{BOOKING_STATUS[b.status]}</p>
                  </div>
                  <div className="flex gap-1">
                    {b.status !== "ATTENDED" && <Btn size="sm" variant="outline" onClick={() => act(() => api(`/api/coaching/bookings/${b.id}`, "PATCH", { status: "ATTENDED" }))}>✅</Btn>}
                    {b.status !== "NO_SHOW" && <Btn size="sm" variant="outline" onClick={() => act(() => api(`/api/coaching/bookings/${b.id}`, "PATCH", { status: "NO_SHOW" }))}>❌</Btn>}
                    {b.status !== "CANCELLED" && <Btn size="sm" variant="ghost" onClick={() => act(() => api(`/api/coaching/bookings/${b.id}`, "PATCH", { status: "CANCELLED" }), "Reserva cancelada")}>Cancelar</Btn>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Select value={bookClient} onChange={(e) => setBookClient(e.target.value)} className="flex-1">
                <option value="">Reservar para un cliente…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Btn disabled={!bookClient} onClick={() => act(() => api("/api/coaching/bookings", "POST", { slotId: detail.id, clientId: bookClient }), "Reserva creada")}>Reservar</Btn>
            </div>
            <Btn variant="danger" className="w-full" onClick={() => { if (confirm("¿Eliminar este horario? Se notificará a los clientes con reserva.")) act(() => api(`/api/coaching/slots/${detail.id}`, "DELETE"), "Horario eliminado") }}>
              <Trash2 className="h-4 w-4" /> Eliminar horario
            </Btn>
          </div>
        )}
      </Modal>
    </>
  )
}
