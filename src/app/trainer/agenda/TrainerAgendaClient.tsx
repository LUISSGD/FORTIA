"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Dumbbell, Video, MapPin, X } from "lucide-react"
import { cn } from "@/lib/utils"

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

type TrainingSlot = {
  sessionId: string
  planId: string
  sessionNumber: number
  scheduledDate: string
  clientId: string
  clientName: string
  startTime: string | null
  attended: boolean | null
}

type CoachingSlot = {
  id: string
  startsAt: string
  endsAt: string
  title: string
  mode: string
  capacity: number
  location: string | null
  bookings: { id: string; status: string; clientId: string; name: string }[]
}

const addDays = (s: string, n: number) => {
  const d = new Date(`${s}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d)
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))

async function patchSession(sessionId: string, body: object) {
  const res = await fetch(`/api/trainer/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j.error ?? "Error al guardar")
  }
  return res.json()
}

export default function TrainerAgendaClient({
  week,
  trainingSlots,
  coachingSlots = [],
}: {
  week: string
  trainingSlots: TrainingSlot[]
  coachingSlots?: CoachingSlot[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<TrainingSlot | null>(null)
  const [newDate, setNewDate] = useState("")
  const [saving, setSaving] = useState(false)
  const today = ymd(new Date())
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))

  async function markAttendance(sessionId: string, attended: boolean | null) {
    setSaving(true)
    try {
      await patchSession(sessionId, { attended })
      toast.success(attended === true ? "Asistencia registrada ✅" : attended === false ? "Inasistencia registrada ❌" : "Marcado deshecho")
      setSelected(null)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function changeDate(sessionId: string, date: string) {
    if (!date) return
    setSaving(true)
    try {
      await patchSession(sessionId, { scheduledDate: date })
      toast.success("Fecha actualizada")
      setSelected(null)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`?week=${addDays(week, -7)}`} className="p-2 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-bold">Semana del {week.split("-").reverse().join("/")}</h1>
          <Link href={`?week=${addDays(week, 7)}`} className="p-2 rounded-lg hover:bg-gray-100">
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link href="/trainer/agenda" className="text-xs text-orange-600 ml-1">Hoy</Link>
        </div>
      </div>

      <div className="grid md:grid-cols-7 gap-3">
        {days.map((d, i) => {
          const dayTraining = trainingSlots.filter((s) => s.scheduledDate === d)
          const dayCoaching = coachingSlots.filter((s) => ymd(new Date(s.startsAt)) === d)

          type Item =
            | { key: string; time: string; kind: "coaching"; slot: CoachingSlot }
            | { key: string; time: string; kind: "training"; session: TrainingSlot }

          const merged: Item[] = [
            ...dayCoaching.map((s) => ({ key: s.id, kind: "coaching" as const, slot: s, time: hhmm(s.startsAt) })),
            ...dayTraining.map((s) => ({ key: s.sessionId, kind: "training" as const, session: s, time: s.startTime?.slice(0, 5) ?? "00:00" })),
          ].sort((a, b) => a.time.localeCompare(b.time))

          const isEmpty = merged.length === 0

          return (
            <div key={d} className={cn("rounded-xl border p-3 space-y-2 bg-white", d === today && "ring-2 ring-orange-300")}>
              <p className="text-xs font-semibold text-gray-500 uppercase">
                {DAYS[i]} <span className="text-gray-900">{d.slice(8)}</span>
              </p>
              <div className="mt-2 space-y-1.5">
                {isEmpty && <p className="text-[11px] text-gray-300">—</p>}
                {merged.map((item) => {
                  if (item.kind === "coaching") {
                    const s = item.slot
                    const booked = s.bookings.filter((b) => ["BOOKED", "ATTENDED", "NO_SHOW"].includes(b.status))
                    return (
                      <div
                        key={item.key}
                        className={cn("w-full text-left rounded-lg px-2 py-1.5 text-xs border", booked.length ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-100")}
                      >
                        <p className="font-semibold">
                          {item.time}
                          {s.mode === "ONLINE" && <Video className="inline h-3 w-3 ml-1" />}
                          {s.mode === "PRESENCIAL" && s.location && <MapPin className="inline h-3 w-3 ml-1" />}
                        </p>
                        {booked.length ? (
                          booked.map((b) => (
                            <p key={b.id} className="truncate">
                              {b.status === "ATTENDED" ? "✅ " : b.status === "NO_SHOW" ? "❌ " : ""}
                              {b.name.split(" ")[0]}
                            </p>
                          ))
                        ) : (
                          <p className="text-gray-400">Libre</p>
                        )}
                        {s.capacity > 1 && <p className="text-[10px] text-gray-400">{booked.length}/{s.capacity}</p>}
                      </div>
                    )
                  }

                  const s = item.session
                  return (
                    <button
                      key={item.key}
                      onClick={() => { setSelected(s); setNewDate(s.scheduledDate) }}
                      className="w-full text-left rounded-lg px-2 py-1.5 text-xs border bg-sky-50 border-sky-200 hover:border-sky-400 block transition-colors"
                    >
                      <div className="flex items-center gap-1 font-semibold text-sky-700">
                        <Dumbbell className="h-3 w-3 shrink-0" />
                        {item.time !== "00:00" ? item.time : "EP"}
                      </div>
                      <p className="truncate text-sky-900">
                        {s.attended === true ? "✅ " : s.attended === false ? "❌ " : ""}
                        {s.clientName.trim().split(" ")[0]}
                      </p>
                      <p className="text-[10px] text-sky-400">S{s.sessionNumber}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de sesión EP */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{selected.clientName.trim()}</p>
                <p className="text-xs text-sky-600">S{selected.sessionNumber} · {selected.startTime?.slice(0, 5) ?? "EP"}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <Link
              href={`/trainer/clients/${selected.clientId}`}
              className="block text-xs text-center text-sky-600 hover:underline"
              onClick={() => setSelected(null)}
            >
              Ver ficha del cliente →
            </Link>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Fecha de la sesión</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  disabled={saving || newDate === selected.scheduledDate}
                  onClick={() => changeDate(selected.sessionId, newDate)}
                  className="px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium disabled:opacity-40"
                >
                  Guardar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Asistencia</p>
              {selected.attended !== null ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">{selected.attended ? "✅ Asistió" : "❌ No asistió"}</p>
                  <button
                    disabled={saving}
                    onClick={() => markAttendance(selected.sessionId, null)}
                    className="w-full py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Deshacer
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={saving}
                    onClick={() => markAttendance(selected.sessionId, true)}
                    className="py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-40"
                  >
                    ✅ Asistió
                  </button>
                  <button
                    disabled={saving}
                    onClick={() => markAttendance(selected.sessionId, false)}
                    className="py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-40"
                  >
                    ❌ No asistió
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
