"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { addCalendarDays } from "@/lib/calendar"
import { Card } from "./ui"

export type AgendaEvent = {
  date: string // YYYY-MM-DD
  kind: "ep" | "cita" | "nutri" | "workout"
  title: string
  time: string | null
  status: "pending" | "pending-past" | "done" | "missed" | "waitlist"
  detail?: string | null
}

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"]
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]

const KIND: Record<AgendaEvent["kind"], { emoji: string; dot: string; label: string }> = {
  ep: { emoji: "🏋️", dot: "bg-orange-500", label: "Clase personalizada" },
  cita: { emoji: "📅", dot: "bg-sky-500", label: "Cita" },
  nutri: { emoji: "🥗", dot: "bg-emerald-500", label: "Nutrición" },
  workout: { emoji: "💪", dot: "bg-gray-400", label: "Entreno" },
}

const STATUS: Record<AgendaEvent["status"], { text: string; cls: string } | null> = {
  pending: null,
  "pending-past": { text: "Sin marcar", cls: "bg-amber-50 text-amber-700" },
  done: { text: "Hecho", cls: "bg-emerald-50 text-emerald-700" },
  missed: { text: "No asistió", cls: "bg-red-50 text-red-600" },
  waitlist: { text: "Lista de espera", cls: "bg-gray-100 text-gray-600" },
}

const weekdayIdx = (ymd: string) => (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Calendario mensual de la app del cliente (estilo agenda): puntos por día y detalle del día elegido. */
export default function AgendaCalendar({ month, today, gridStart, gridEnd, events, initialDay }: { month: string; today: string; gridStart: string; gridEnd: string; events: AgendaEvent[]; initialDay: string | null }) {
  const byDay = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>()
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e])
    for (const list of map.values()) list.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"))
    return map
  }, [events])

  const defaultDay = initialDay && initialDay.startsWith(month) ? initialDay : today.startsWith(month) ? today : `${month}-01`
  const [selected, setSelected] = useState(defaultDay)

  const days: string[] = []
  for (let d = gridStart; d <= gridEnd; d = addCalendarDays(d, 1)) days.push(d)
  const [y, m] = month.split("-").map(Number)
  const dayEvents = byDay.get(selected) ?? []
  const [sy, sm, sd] = selected.split("-").map(Number)

  // Próximas clases personalizadas (desde hoy), para tenerlas a mano debajo del calendario
  const upcomingEp = events.filter((e) => e.kind === "ep" && e.date >= today && e.status === "pending").sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3)

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black tracking-tight text-gray-900">Agenda</h1>

      <Card className="px-3">
        <div className="flex items-center justify-between mb-3">
          <Link href={`/app/agenda?mes=${shiftMonth(month, -1)}`} className="p-2 text-gray-500" aria-label="Mes anterior"><ChevronLeft className="h-5 w-5" /></Link>
          <p className="font-bold text-gray-800">{MONTHS[m - 1]} {y}</p>
          <Link href={`/app/agenda?mes=${shiftMonth(month, 1)}`} className="p-2 text-gray-500" aria-label="Mes siguiente"><ChevronRight className="h-5 w-5" /></Link>
        </div>

        <div className="grid grid-cols-7 text-center text-xs font-bold text-gray-500 mb-1">
          {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {days.map((d) => {
            const inMonth = d.startsWith(month)
            const evs = byDay.get(d) ?? []
            const kinds = [...new Set(evs.map((e) => e.kind))]
            const isSel = d === selected
            return (
              <button key={d} onClick={() => setSelected(d)} className="flex flex-col items-center py-1" aria-label={`${d}${evs.length ? `, ${evs.length} actividades` : ""}`}>
                <span
                  className={cn(
                    "h-10 w-10 flex items-center justify-center rounded-full text-[15px] font-bold transition",
                    isSel ? "bg-gray-900 text-white" : d === today ? "ring-2 ring-orange-400 text-gray-900" : inMonth ? "text-gray-900" : "text-gray-300",
                  )}
                >
                  {Number(d.slice(8))}
                </span>
                <span className="h-2 flex items-center gap-0.5 mt-0.5">
                  {kinds.slice(0, 3).map((k) => <span key={k} className={cn("h-1.5 w-1.5 rounded-full", KIND[k].dot, !inMonth && "opacity-40")} />)}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
          {(["ep", "cita", "nutri", "workout"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1"><span className={cn("h-1.5 w-1.5 rounded-full", KIND[k].dot)} />{KIND[k].label}</span>
          ))}
        </div>
      </Card>

      <Card>
        <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mb-3">
          {selected === today ? "Hoy, " : ""}{DAY_NAMES[weekdayIdx(selected)]} {sd} de {MONTHS[sm - 1].toLowerCase()}{sy !== y ? ` ${sy}` : ""}
        </p>
        {dayEvents.length === 0 ? (
          <p className="text-sm text-gray-400">No tienes nada programado este día.</p>
        ) : (
          <ul className="space-y-2">
            {dayEvents.map((e, i) => {
              const st = STATUS[e.status]
              return (
                <li key={i} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                  <span className={cn("h-9 w-1 rounded-full shrink-0", KIND[e.kind].dot)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{KIND[e.kind].emoji} {e.title}</p>
                    <p className="text-xs text-gray-500">{[e.time, e.detail].filter(Boolean).join(" · ") || KIND[e.kind].label}</p>
                  </div>
                  {st && <span className={cn("text-[11px] font-semibold rounded-full px-2 py-0.5 shrink-0", st.cls)}>{st.text}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {upcomingEp.length > 0 && (
        <Card>
          <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mb-2">Próximas clases</p>
          <ul className="divide-y divide-gray-100">
            {upcomingEp.map((e, i) => {
              const [, mm, dd] = e.date.split("-").map(Number)
              return (
                <li key={i} className="flex justify-between py-2 text-sm">
                  <span className="capitalize">{DAY_NAMES[weekdayIdx(e.date)]} {dd} {MONTHS[mm - 1].slice(0, 3).toLowerCase()}</span>
                  <span className="text-gray-500">{e.time ?? ""}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
