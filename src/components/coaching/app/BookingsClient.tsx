"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Card, SectionTitle } from "./ui"

type Slot = { id: string; startsAt: string; title: string; mode: string; free: number; capacity: number; mine: string | null }
type Mine = { id: string; status: string; startsAt: string; title: string; mode: string; location: string | null }

const TZ = "America/Lima"
const ymd = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso))
const time = (iso: string) => new Intl.DateTimeFormat("es-PE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
const dayLabel = (iso: string) => new Intl.DateTimeFormat("es-PE", { timeZone: TZ, weekday: "long", day: "numeric", month: "short" }).format(new Date(iso))

export default function BookingsClient({ slots, mine }: { slots: Slot[]; mine: Mine[] }) {
  const router = useRouter()
  const days = useMemo(() => [...new Set(slots.map((s) => ymd(s.startsAt)))], [slots])
  const [day, setDay] = useState(days[0] ?? "")
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const daySlots = slots.filter((s) => ymd(s.startsAt) === day)

  async function book() {
    if (!picked) return
    setBusy(true)
    const res = await fetch("/api/app/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slotId: picked }) })
    const d = await res.json()
    setBusy(false)
    if (!res.ok) return toast.error(d.error ?? "No se pudo reservar")
    toast.success(d.status === "WAITLIST" ? "Estás en lista de espera. Te avisamos si se libera un cupo." : "¡Sesión reservada! 💪")
    setPicked(null)
    router.refresh()
  }

  async function cancel(id: string) {
    if (!confirm("¿Cancelar esta reserva?")) return
    const res = await fetch(`/api/app/bookings?id=${id}`, { method: "DELETE" })
    const d = await res.json()
    if (!res.ok) return toast.error(d.error ?? "No se pudo cancelar")
    toast.success("Reserva cancelada")
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {mine.length > 0 && (
        <Card>
          <SectionTitle emoji="✅">Tus reservas</SectionTitle>
          <ul className="divide-y divide-gray-100">
            {mine.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-semibold capitalize text-gray-900">{dayLabel(b.startsAt)} · {time(b.startsAt)}</p>
                  <p className="text-xs text-gray-400">
                    {b.title} · {b.mode === "ONLINE" ? "Online" : "Presencial"}{b.status === "WAITLIST" && <span className="text-amber-600"> · Lista de espera</span>}
                  </p>
                  {b.location && b.mode === "ONLINE" && /^https?:/.test(b.location) && <a href={b.location} target="_blank" rel="noreferrer" className="text-xs text-orange-500">Unirse a la videollamada →</a>}
                </div>
                <button onClick={() => cancel(b.id)} className="text-xs text-gray-400 border border-gray-200 rounded-lg px-2.5 py-1">Cancelar</button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {slots.length === 0 ? (
        <Card><p className="text-sm text-gray-400">No hay horarios disponibles por ahora. Escríbele a tu coach por el chat.</p></Card>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
            {days.map((d) => {
              const iso = slots.find((s) => ymd(s.startsAt) === d)!.startsAt
              const [wd, num] = new Intl.DateTimeFormat("es-PE", { timeZone: TZ, weekday: "short", day: "numeric" }).format(new Date(iso)).split(" ")
              return (
                <button key={d} onClick={() => { setDay(d); setPicked(null) }} className={cn("shrink-0 w-14 rounded-2xl py-2 text-center", d === day ? "bg-orange-500 text-white" : "bg-gray-100 border border-gray-200 text-gray-700")}>
                  <p className="text-[10px] uppercase">{wd.replace(",", "")}</p>
                  <p className="text-lg font-black">{num}</p>
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {daySlots.map((s) => {
              const full = s.free === 0
              return (
                <button
                  key={s.id}
                  disabled={!!s.mine}
                  onClick={() => setPicked(s.id)}
                  className={cn(
                    "rounded-xl py-3 text-center border",
                    s.mine ? "bg-emerald-50 border-emerald-200 text-emerald-600" : picked === s.id ? "bg-gray-900 text-white border-gray-900" : "bg-gray-50 border-gray-200 text-gray-900"
                  )}
                >
                  <p className="font-black">{time(s.startsAt)}</p>
                  <p className="text-[10px] opacity-70">{s.mine ? (s.mine === "WAITLIST" ? "En espera" : "Reservado") : full ? "Lista de espera" : s.capacity > 1 ? `${s.free} cupos` : s.mode === "ONLINE" ? "Online" : "Libre"}</p>
                </button>
              )
            })}
          </div>
          <button onClick={book} disabled={!picked || busy} className="w-full h-12 rounded-xl bg-orange-500 text-white font-bold disabled:opacity-40">RESERVAR</button>
        </>
      )}
    </div>
  )
}
