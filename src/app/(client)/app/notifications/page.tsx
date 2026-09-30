import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import { dateTimeLima } from "@/lib/coaching/dates"
import { cn } from "@/lib/utils"
import { Card, PageTitle } from "@/components/coaching/app/ui"
import MarkAllRead from "@/components/coaching/app/MarkAllRead"

const ICON: Record<string, string> = { WORKOUT: "🏋️", NUTRITION: "🥗", CHECKIN: "📝", BOOKING: "📅", MESSAGE: "💬", PAYMENT: "💳", ACHIEVEMENT: "🏆", SYSTEM: "🔔", INACTIVITY: "💪", WEEK_COMPLETED: "🔥", BIRTHDAY: "🎂", WORKOUT_READY: "🏋️", NUTRITION_REMINDER: "🥗", CHECKIN_REMINDER: "📝", BOOKING_REMINDER: "📅", PAYMENT_REMINDER: "💳" }

export default async function NotificationsPage() {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const items = await prisma.notification.findMany({ where: { clientId: ctx.clientId, audience: "CLIENT" }, orderBy: { createdAt: "desc" }, take: 60 })
  const unread = items.some((n) => !n.readAt)
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <PageTitle title="Notificaciones" />
        {unread && <MarkAllRead />}
      </div>
      {items.length === 0 ? (
        <Card><p className="text-sm text-gray-400">Sin notificaciones por ahora.</p></Card>
      ) : (
        <div className="rounded-2xl bg-white border border-gray-100 divide-y divide-gray-100">
          {items.map((n) => (
            <Link key={n.id} href={n.link ?? "/app"} className={cn("flex gap-3 px-4 py-3", !n.readAt && "bg-orange-500/5")}>
              <span className="text-xl">{ICON[n.type] ?? "🔔"}</span>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm", !n.readAt ? "font-bold text-gray-900" : "font-medium text-gray-600")}>{n.title}</p>
                {n.body && <p className="text-xs text-gray-400 line-clamp-2">{n.body}</p>}
                <p className="text-[10px] text-gray-400 mt-0.5">{dateTimeLima(n.createdAt)}</p>
              </div>
              {!n.readAt && <span className="h-2 w-2 rounded-full bg-orange-500 mt-2" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
