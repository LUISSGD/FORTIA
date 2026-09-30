"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Users, CalendarDays, MessageSquare, LayoutDashboard, LogOut } from "lucide-react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"

const items = [
  { href: "/nutrition", label: "Inicio", icon: LayoutDashboard },
  { href: "/nutrition/clients", label: "Clientes", icon: Users },
  { href: "/nutrition/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/nutrition/messages", label: "Mensajes", icon: MessageSquare },
]

export default function NutritionNav({ desktop, mobile }: { desktop?: boolean; mobile?: boolean }) {
  const path = usePathname()

  if (desktop) {
    return (
      <nav className="flex items-center gap-1 flex-1">
        {items.map(({ href, label }) => {
          const active = href === "/nutrition" ? path === "/nutrition" : path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                active ? "bg-orange-50 text-orange-600" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              {label}
            </Link>
          )
        })}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4" /> Salir
        </button>
      </nav>
    )
  }

  if (mobile) {
    return (
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 flex h-16">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/nutrition" ? path === "/nutrition" : path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px]",
                active ? "text-orange-500" : "text-gray-500"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          )
        })}
      </nav>
    )
  }

  return null
}
