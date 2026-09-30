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
      <nav className="flex items-center gap-0.5 flex-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/nutrition" ? path === "/nutrition" : path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-orange-50 text-orange-600"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="ml-auto flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all"
        >
          <LogOut className="h-4 w-4" />
          Salir
        </button>
      </nav>
    )
  }

  if (mobile) {
    return (
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100 flex h-16 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/nutrition" ? path === "/nutrition" : path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                active ? "text-orange-500" : "text-gray-400"
              )}
            >
              <div className={cn(
                "h-8 w-8 rounded-xl flex items-center justify-center transition-colors",
                active ? "bg-orange-50" : ""
              )}>
                <Icon className="h-5 w-5" />
              </div>
              {label}
            </Link>
          )
        })}
      </nav>
    )
  }

  return null
}
