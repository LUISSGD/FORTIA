"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, Calendar, DollarSign, ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/schedule", label: "Agenda", icon: Calendar },
  { href: "/finances", label: "Finanzas", icon: DollarSign },
  { href: "/finances/monthly-expenses", label: "Gastos", icon: ClipboardList },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800">
      <div className="flex">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                isActive ? "text-orange-400" : "text-gray-500"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-orange-400" : "text-gray-500")} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
