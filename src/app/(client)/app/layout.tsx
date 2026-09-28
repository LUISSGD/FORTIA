import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import type { Metadata, Viewport } from "next"
import { Bell } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import ClientBottomNav from "@/components/coaching/app/ClientBottomNav"
import ChatFab from "@/components/coaching/app/ChatFab"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "FORTIA Coaching",
  description: "Tu entrenamiento, nutrición y progreso con tu coach",
  appleWebApp: { capable: true, title: "FORTIA", statusBarStyle: "black-translucent" },
}

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default async function ClientAppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const [unreadNotifs, unreadMsgs] = await Promise.all([
    prisma.notification.count({ where: { clientId: ctx.clientId, audience: "CLIENT", readAt: null, type: { not: "MESSAGE" } } }),
    prisma.coachMessage.count({ where: { clientId: ctx.clientId, sender: { not: "CLIENT" }, readAt: null } }),
  ])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-900" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-md mx-auto flex items-center justify-between px-4 h-14">
          <Link href="/app" className="flex items-center gap-2">
            <Image src="/logo.png" alt="FORTIA" width={28} height={28} className="rounded-md" />
            <span className="font-black tracking-widest text-sm">FORTIA <span className="text-orange-500">COACHING</span></span>
          </Link>
          <Link href="/app/notifications" className="relative p-2 -mr-2" aria-label="Notificaciones">
            <Bell className="h-5 w-5 text-zinc-300" />
            {unreadNotifs > 0 && (
              <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-orange-500 text-[10px] font-bold flex items-center justify-center">{unreadNotifs > 9 ? "9+" : unreadNotifs}</span>
            )}
          </Link>
        </div>
      </header>
      <main className="max-w-md mx-auto px-4 pt-4 pb-28">{children}</main>
      <ChatFab unread={unreadMsgs} />
      <ClientBottomNav />
    </div>
  )
}
