"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, MessageSquare, CalendarDays, ChefHat } from "lucide-react"
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
  new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d))

export default function NutritionClientsSearch({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("")
  const filtered = q.trim()
    ? rows.filter((r) => `${r.firstName} ${r.lastName}`.toLowerCase().includes(q.toLowerCase()))
    : rows

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar cliente…"
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-8">Sin resultados</p>
      )}

      <div className="divide-y divide-gray-100 bg-white border border-gray-100 rounded-xl overflow-hidden">
        {filtered.map((r) => (
          <Link key={r.id} href={`/nutrition/clients/${r.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600 shrink-0">
              {r.firstName[0]}{r.lastName?.[0] ?? ""}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{r.firstName} {r.lastName}</p>
              {r.goal && <p className="text-xs text-gray-400 truncate">{r.goal}</p>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {r.activePlan && (
                <span title={r.activePlan.name} className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <ChefHat className="h-3 w-3" /> Plan activo
                </span>
              )}
              {r.nextAppointment && (
                <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  <CalendarDays className="h-3 w-3" /> {fmtDate(r.nextAppointment)}
                </span>
              )}
              {r.lastMessage && !r.lastMessage.readAt && r.lastMessage.sender === "CLIENT" && (
                <span className="h-2 w-2 rounded-full bg-orange-500" />
              )}
              {r.lastMessage && (
                <MessageSquare className={cn("h-4 w-4", !r.lastMessage.readAt && r.lastMessage.sender === "CLIENT" ? "text-orange-500" : "text-gray-300")} />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
