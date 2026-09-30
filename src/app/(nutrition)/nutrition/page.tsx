import { requireNutritionist } from "@/lib/coaching/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Users, CalendarDays, MessageSquare, ChevronRight, Clock } from "lucide-react"

export const dynamic = "force-dynamic"

function initials(first: string, last?: string | null) {
  return `${first[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase()
}

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d)
}

function fmtRelative(d: Date) {
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "ahora"
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  return days === 1 ? "ayer" : `hace ${days} días`
}

export default async function NutritionHome() {
  const guard = await requireNutritionist()
  if ("error" in guard) redirect("/login")

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  const [activeCount, todaySlots, unread, recentMessages] = await Promise.all([
    prisma.coachingProfile.count({ where: { status: { in: ["ACTIVE", "PAUSED"] } } }),
    prisma.coachingSlot.findMany({
      where: { type: "NUTRITION", startsAt: { gte: todayStart, lte: todayEnd } },
      include: {
        bookings: {
          where: { status: "BOOKED" },
          include: { client: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.coachMessage.count({ where: { channel: "NUTRITION", sender: "CLIENT", readAt: null } }),
    prisma.coachMessage.findMany({
      where: { channel: "NUTRITION" },
      distinct: ["clientId"],
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
    }),
  ])

  const hour = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "numeric", hour12: false }).format(now)
  const greeting = Number(hour) < 12 ? "Buenos días" : Number(hour) < 19 ? "Buenas tardes" : "Buenas noches"

  const dateLabel = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Greeting */}
      <div>
        <p className="text-sm font-medium text-orange-500 capitalize">{dateLabel}</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-0.5">{greeting} 👋</h1>
        <p className="text-sm text-gray-500 mt-0.5">Aquí está el resumen de hoy.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/nutrition/clients" className="group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md shadow-orange-200 hover:shadow-lg hover:shadow-orange-200 transition-all">
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center mb-3">
            <Users className="h-5 w-5" />
          </div>
          <p className="text-3xl font-black tabular-nums">{activeCount}</p>
          <p className="text-xs font-medium text-orange-100 mt-0.5">Clientes activos</p>
        </Link>

        <Link href="/nutrition/agenda" className="group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-200 hover:shadow-lg hover:shadow-violet-200 transition-all">
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center mb-3">
            <CalendarDays className="h-5 w-5" />
          </div>
          <p className="text-3xl font-black tabular-nums">{todaySlots.length}</p>
          <p className="text-xs font-medium text-violet-100 mt-0.5">Citas hoy</p>
        </Link>

        <Link href="/nutrition/messages" className="group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-200 transition-all">
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center mb-3">
            <MessageSquare className="h-5 w-5" />
          </div>
          <p className="text-3xl font-black tabular-nums">{unread}</p>
          <p className="text-xs font-medium text-emerald-100 mt-0.5">Mensajes nuevos</p>
          {unread > 0 && (
            <span className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
          )}
        </Link>
      </div>

      {/* Today's appointments */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-gray-800">Agenda de hoy</h2>
          </div>
          <Link href="/nutrition/agenda" className="text-xs text-orange-500 font-medium hover:text-orange-600 flex items-center gap-0.5">
            Ver todo <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {todaySlots.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-3">
              <CalendarDays className="h-6 w-6 text-violet-300" />
            </div>
            <p className="text-sm text-gray-400">Sin citas programadas para hoy</p>
            <Link href="/nutrition/agenda" className="mt-3 inline-block text-xs font-medium text-orange-500 hover:text-orange-600">
              Crear un horario →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {todaySlots.map((slot) => {
              const booking = slot.bookings[0]
              return (
                <div key={slot.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                  <div className="text-center shrink-0 w-12">
                    <span className="text-sm font-bold text-violet-600 tabular-nums">{fmtTime(slot.startsAt)}</span>
                  </div>
                  <div className="h-8 w-0.5 rounded-full bg-violet-100 shrink-0" />
                  {booking ? (
                    <Link href={`/nutrition/clients/${booking.client.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:text-orange-600 transition-colors">
                      <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600 shrink-0">
                        {initials(booking.client.firstName, booking.client.lastName)}
                      </div>
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {booking.client.firstName} {booking.client.lastName}
                      </span>
                    </Link>
                  ) : (
                    <Link href="/nutrition/agenda" className="flex-1 text-sm text-gray-400 italic hover:text-orange-500 transition-colors">
                      Hora libre — asignar cliente
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent messages */}
      {recentMessages.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-gray-800">Conversaciones recientes</h2>
            </div>
            <Link href="/nutrition/messages" className="text-xs text-orange-500 font-medium hover:text-orange-600 flex items-center gap-0.5">
              Ver todo <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentMessages.map((m) => {
              const isUnread = !m.readAt && m.sender === "CLIENT"
              return (
                <Link
                  key={m.id}
                  href={`/nutrition/clients/${m.client.id}?tab=chat`}
                  className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="relative shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                      {initials(m.client.firstName, m.client.lastName)}
                    </div>
                    {isUnread && (
                      <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`text-sm truncate ${isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                        {m.client.firstName} {m.client.lastName}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">{fmtRelative(m.createdAt)}</span>
                    </div>
                    <p className={`text-xs mt-0.5 truncate ${isUnread ? "text-gray-600" : "text-gray-400"}`}>
                      {m.sender === "CLIENT" ? "" : "Tú: "}{m.body}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
