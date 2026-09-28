"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageCircle } from "lucide-react"

export default function ChatFab({ unread }: { unread: number }) {
  const pathname = usePathname()
  if (pathname.startsWith("/app/chat") || pathname.startsWith("/app/workout/")) return null
  return (
    <Link
      href="/app/chat"
      aria-label="Chat con tu coach"
      className="fixed z-50 right-4 bottom-20 h-14 w-14 rounded-full bg-orange-500 shadow-lg shadow-orange-500/30 flex items-center justify-center active:scale-95 transition"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <MessageCircle className="h-6 w-6 text-white" />
      {unread > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-white text-orange-600 text-[11px] font-bold flex items-center justify-center">{unread}</span>}
    </Link>
  )
}
