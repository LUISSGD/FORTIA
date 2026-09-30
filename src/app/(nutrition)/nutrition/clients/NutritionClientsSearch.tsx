"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, MessageSquare, CalendarDays, ChefHat, ChevronRight, Users } from "lucide-react"
import { cn } from "@/lib/utils"

type Row = {
  id: string
  firstName: string
  lastName: string
  status: string
  goal: string | null
  activePlan: { id: string; name: string } | null
  lastMessage: { body: string; sender: string; readAt: string | null } | null
  nextAppointment: string | null
}

const fmtDate = (d: string) =>
  new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(d))

const AVATAR_COLORS = [
  "from-orange-400 to-orange-500",
  "from-violet-400 to-purple-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-pink-500",
  "from-sky-400 to-blue-500",
  "from-amber-400 to-orange-400",
]

function avatarColor(name: string) {
  const i = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[i]
}

export default function NutritionClientsSearch({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("")
  const filtered = q.trim()
    ? rows.filter((r) => `${r.firstName} ${r.lastName}`.toLowerCase().includes(q.toLowerCase()))
    : rows

  const hasUnread = (r: Row) => r.lastMessage && !r.lastMessage.readAt && r.lastMessage.sender === "CLIENT"

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar cliente…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition shadow-sm"
        />
      </div>

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Users className="h-7 w-7 text-gray-300" />
          </div>
          <p className="text-sm text-gray-400">{q ? "Sin resultados para esa búsqueda" : "No hay clientes activos"}</p>
        </div>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((r) => {
          const unread = hasUnread(r)
          const initials = `${r.firstName[0] ?? ""}${r.lastName?.[0] ?? ""}`.toUpperCase()
          return (
            <Link
              key={r.id}
              href={`/nutrition/clients/${r.id}`}
              className={cn(
                "group relative bg-white rounded-2xl border p-4 flex flex-col gap-3 hover:shadow-md transition-all",
                unread ? "border-orange-200 shadow-sm shadow-orange-100" : "border-gray-100"
              )}
            >
              {/* Unread badge */}
              {unread && (
                <span className="absolute top-3.5 right-3.5 h-2.5 w-2.5 rounded-full bg-orange-500" />
              )}

              {/* Top: avatar + name */}
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-11 w-11 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-bold text-white shadow-sm shrink-0",
                  avatarColor(r.firstName)
                )}>
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
                    {r.firstName} {r.lastName}
                  </p>
                  <span className={cn(
                    "inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mt-0.5",
                    r.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-amber-50 text-amber-600"
                  )}>
                    {r.status === "ACTIVE" ? "Activo" : "Pausado"}
                  </span>
                </div>
              </div>

              {/* Goal */}
              {r.goal && (
                <p className="text-xs text-gray-400 leading-snug line-clamp-2">{r.goal}</p>
              )}

              {/* Badges row */}
              <div className="flex flex-wrap gap-1.5">
                {r.activePlan && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    <ChefHat className="h-3 w-3" />
                    Plan activo
                  </span>
                )}
                {r.nextAppointment && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">
                    <CalendarDays className="h-3 w-3" />
                    {fmtDate(r.nextAppointment)}
                  </span>
                )}
                {r.lastMessage && (
                  <span className={cn(
                    "flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border",
                    unread
                      ? "text-orange-700 bg-orange-50 border-orange-100"
                      : "text-gray-500 bg-gray-50 border-gray-100"
                  )}>
                    <MessageSquare className="h-3 w-3" />
                    {unread ? "Mensaje nuevo" : "Mensaje"}
                  </span>
                )}
              </div>

              {/* Footer link */}
              <div className="flex items-center justify-end mt-auto">
                <span className="text-xs text-orange-500 font-medium flex items-center gap-0.5 group-hover:gap-1 transition-all">
                  Ver ficha <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
