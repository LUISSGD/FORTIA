"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, CalendarDays, Dumbbell, Salad, TrendingUp, User } from "lucide-react"
import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/app", label: "Inicio", icon: Home },
  { href: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/app/training", label: "Entreno", icon: Dumbbell },
  { href: "/app/nutrition", label: "Nutrición", icon: Salad },
  { href: "/app/progress", label: "Progreso", icon: TrendingUp },
  { href: "/app/profile", label: "Perfil", icon: User },
]

export default function ClientBottomNav() {
  const pathname = usePathname()
  if (pathname.startsWith("/app/workout/")) return null
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur border-t border-gray-100" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="max-w-md mx-auto flex">
        {ITEMS.map((it) => {
          const active = it.href === "/app" ? pathname === "/app" : pathname.startsWith(it.href)
          return (
            <Link key={it.href} href={it.href} className={cn("flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium", active ? "text-orange-500" : "text-gray-400")}>
              <it.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              {it.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
