"use client"

import { useState } from "react"
import { Plus, Trash2, CalendarDays, User } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Booking = { id: string; clientId: string; clientName: string }
type Slot = { id: string; startsAt: Date; endsAt: Date; title: string; mode: string; location: string; bookings: Booking[] }
type Client = { id: string; name: string }

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d))

const dateStr = (d: Date) => new Date(d).toISOString().slice(0, 16)

export default function NutritionAgendaClient({ slots: initial, clients }: { slots: Slot[]; clients: Client[] }) {
  const [slots, setSlots] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ startsAt: "", endsAt: "", location: "", mode: "ONLINE" })
  const [saving, setSaving] = useState(false)
  const [bookingSlot, setBookingSlot] = useState<string | null>(null)
  const [bookClientId, setBookClientId] = useState("")

  async function createSlot(e: React.FormEvent) {
    e.preventDefault()
    if (!form.startsAt || !form.endsAt) return
    setSaving(true)
    try {
      const res = await fetch("/api/nutrition/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: form.startsAt, endsAt: form.endsAt, mode: form.mode, location: form.location }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const slot = await res.json()
      setSlots((s) => [...s, { ...slot, bookings: [] }].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()))
      setForm({ startsAt: "", endsAt: "", location: "", mode: "ONLINE" })
      setShowForm(false)
      toast.success("Slot creado")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteSlot(id: string) {
    if (!confirm("¿Eliminar este slot?")) return
    const res = await fetch(`/api/nutrition/slots/${id}`, { method: "DELETE" })
    if (res.ok) setSlots((s) => s.filter((x) => x.id !== id))
    else toast.error("No se pudo eliminar")
  }

  async function bookSlot(slotId: string) {
    if (!bookClientId) return
    setSaving(true)
    try {
      const res = await fetch("/api/nutrition/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, clientId: bookClientId }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const booking = await res.json()
      const client = clients.find((c) => c.id === bookClientId)
      setSlots((s) =>
        s.map((x) =>
          x.id === slotId ? { ...x, bookings: [...x.bookings, { id: booking.id, clientId: bookClientId, clientName: client?.name ?? "" }] } : x
        )
      )
      setBookingSlot(null)
      setBookClientId("")
      toast.success("Cita agendada")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const now = new Date()
  const upcoming = slots.filter((s) => new Date(s.startsAt) >= now)
  const past = slots.filter((s) => new Date(s.startsAt) < now)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Agenda de nutrición</h1>
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1.5 bg-orange-500 text-white text-sm px-3 py-2 rounded-xl hover:bg-orange-600">
          <Plus className="h-4 w-4" /> Nuevo slot
        </button>
      </div>

      {showForm && (
        <form onSubmit={createSlot} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Crear slot de consulta</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Inicio</label>
              <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Fin</label>
              <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} required className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Modalidad</label>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5">
                <option value="ONLINE">Online</option>
                <option value="PRESENCIAL">Presencial</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Lugar / enlace</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Zoom / consultorio…" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">Cancelar</button>
            <button type="submit" disabled={saving} className="text-sm bg-orange-500 text-white px-4 py-1.5 rounded-lg hover:bg-orange-600 disabled:opacity-50">Guardar</button>
          </div>
        </form>
      )}

      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Próximas ({upcoming.length})</p>
          <div className="space-y-2">
            {upcoming.map((s) => (
              <SlotCard key={s.id} slot={s} clients={clients} onDelete={deleteSlot} onBook={() => setBookingSlot(s.id)}
                bookingOpen={bookingSlot === s.id} bookClientId={bookClientId} setBookClientId={setBookClientId} onConfirmBook={() => bookSlot(s.id)} onCancelBook={() => { setBookingSlot(null); setBookClientId("") }} saving={saving} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <details>
          <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-600">
            Pasadas ({past.length})
          </summary>
          <div className="space-y-2 mt-2">
            {past.map((s) => (
              <SlotCard key={s.id} slot={s} clients={clients} onDelete={deleteSlot} past />
            ))}
          </div>
        </details>
      )}

      {slots.length === 0 && !showForm && (
        <div className="text-center py-12 text-gray-400">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin slots creados. Crea el primero con el botón de arriba.</p>
        </div>
      )}
    </div>
  )
}

function SlotCard({
  slot, clients, onDelete, past, onBook, bookingOpen, bookClientId, setBookClientId, onConfirmBook, onCancelBook, saving,
}: {
  slot: Slot; clients: Client[]; onDelete: (id: string) => void; past?: boolean
  onBook?: () => void; bookingOpen?: boolean; bookClientId?: string; setBookClientId?: (v: string) => void
  onConfirmBook?: () => void; onCancelBook?: () => void; saving?: boolean
}) {
  const booked = slot.bookings[0]
  return (
    <div className={cn("bg-white border rounded-xl px-4 py-3 space-y-2", past ? "border-gray-100 opacity-60" : "border-gray-200")}>
      <div className="flex items-center gap-3">
        <CalendarDays className={cn("h-5 w-5 shrink-0", booked ? "text-orange-500" : "text-gray-300")} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{fmt(slot.startsAt)}</p>
          {slot.mode && <p className="text-xs text-gray-400">{slot.mode}{slot.location ? ` · ${slot.location}` : ""}</p>}
        </div>
        {booked ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <User className="h-3.5 w-3.5" /> {booked.clientName}
          </div>
        ) : !past ? (
          <button onClick={onBook} className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded-lg hover:bg-orange-100">Agendar</button>
        ) : null}
        {!past && (
          <button onClick={() => onDelete(slot.id)} className="text-gray-300 hover:text-red-400">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {bookingOpen && setBookClientId && (
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <select value={bookClientId} onChange={(e) => setBookClientId(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
            <option value="">Seleccionar cliente…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={onConfirmBook} disabled={!bookClientId || saving} className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 disabled:opacity-50">Confirmar</button>
          <button onClick={onCancelBook} className="text-sm text-gray-500 px-2 py-1.5 rounded-lg hover:bg-gray-100">✕</button>
        </div>
      )}
    </div>
  )
}
