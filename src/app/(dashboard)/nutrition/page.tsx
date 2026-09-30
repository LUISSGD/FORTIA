import { requireNutritionist } from "@/lib/coaching/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Users, CalendarDays, MessageSquare } from "lucide-react"

export const dynamic = "force-dynamic"

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
      include: { bookings: { where: { status: "BOOKED" }, include: { client: { select: { id: true, firstName: true, lastName: true } } } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.coachMessage.count({ where: { channel: "NUTRITION", sender: "CLIENT", readAt: null } }),
    prisma.coachMessage.findMany({
      where: { channel: "NUTRITION" },
      distinct: ["clientId"],
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
    }),
  ])

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false }).format(d)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Panel de nutrición</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Link href="/nutrition/clients" className="bg-gray-50 rounded-xl p-4 hover:bg-orange-50 transition-colors">
          <Users className="h-6 w-6 text-orange-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
          <p className="text-sm text-gray-500">Clientes activos</p>
        </Link>
        <Link href="/nutrition/agenda" className="bg-gray-50 rounded-xl p-4 hover:bg-orange-50 transition-colors">
          <CalendarDays className="h-6 w-6 text-orange-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{todaySlots.length}</p>
          <p className="text-sm text-gray-500">Citas hoy</p>
        </Link>
        <Link href="/nutrition/messages" className="bg-gray-50 rounded-xl p-4 hover:bg-orange-50 transition-colors relative">
          <MessageSquare className="h-6 w-6 text-orange-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{unread}</p>
          <p className="text-sm text-gray-500">Mensajes nuevos</p>
          {unread > 0 && <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-orange-500" />}
        </Link>
      </div>

      {/* Today's appointments */}
      {todaySlots.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Citas de hoy</h2>
          <div className="space-y-2">
            {todaySlots.map((slot) => {
              const booking = slot.bookings[0]
              return (
                <div key={slot.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                  <span className="text-sm font-semibold text-orange-500 tabular-nums w-12 shrink-0">{fmt(slot.startsAt)}</span>
                  {booking ? (
                    <Link href={`/nutrition/clients/${booking.client.id}`} className="flex-1 text-sm font-medium text-gray-900 hover:text-orange-600">
                      {booking.client.firstName} {booking.client.lastName}
                    </Link>
                  ) : (
                    <span className="flex-1 text-sm text-gray-400 italic">Libre</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent messages */}
      {recentMessages.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Conversaciones recientes</h2>
          <div className="divide-y divide-gray-100 bg-white border border-gray-100 rounded-xl overflow-hidden">
            {recentMessages.map((m) => (
              <Link key={m.id} href={`/nutrition/clients/${m.client.id}?tab=chat`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600 shrink-0">
                  {m.client.firstName[0]}{m.client.lastName?.[0] ?? ""}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{m.client.firstName} {m.client.lastName}</p>
                  <p className="text-xs text-gray-400 truncate">{m.body}</p>
                </div>
                {!m.readAt && m.sender === "CLIENT" && <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0" />}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
