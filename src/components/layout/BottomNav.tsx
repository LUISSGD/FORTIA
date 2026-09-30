"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { signOut } from "next-auth/react"
import { HeartPulse, Dumbbell, Calendar, DollarSign, Users, LayoutDashboard, Settings, UserCog, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

const adminNavItems = [
  { href: "/coaching/clients", label: "Clientes", icon: HeartPulse },
  { href: "/coaching/programs", label: "Librería", icon: Dumbbell },
  { href: "/coaching/agenda", label: "Agenda", icon: Calendar },
  { href: "/finances", label: "Finanzas", icon: DollarSign },
]

const userNavItems = [
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/schedule", label: "Agenda", icon: Calendar },
  { href: "/finances", label: "Finanzas", icon: DollarSign },
  { href: "/training-plans", label: "Entrena.", icon: Dumbbell },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role ?? "ADMIN"
  const navItems = role === "USER" ? userNavItems : adminNavItems
  const [profileOpen, setProfileOpen] = useState(false)

  const initials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("") ?? "A"

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-gray-900" : "text-gray-400"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-gray-900" : "text-gray-400")} />
                {item.label}
              </Link>
            )
          })}

          {/* Profile tab */}
          <button
            onClick={() => setProfileOpen(true)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-gray-400"
          >
            <div className="h-5 w-5 rounded-full bg-orange-500 flex items-center justify-center text-white text-[9px] font-bold">
              {initials}
            </div>
            Perfil
          </button>
        </div>
      </nav>

      {/* Profile bottom sheet */}
      {profileOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60]"
          onClick={() => setProfileOpen(false)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl border-t border-gray-100 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* User info */}
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{session?.user?.name}</p>
                  <p className="text-xs text-gray-400 truncate">{session?.user?.email}</p>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-2">
              <Link
                href="/dashboard"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-3 px-5 py-3.5 text-sm text-gray-600 active:bg-gray-50"
              >
                <LayoutDashboard className="h-5 w-5 text-gray-400 shrink-0" />
                Dashboard
              </Link>
              <Link
                href="/coaching/automations"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-3 px-5 py-3.5 text-sm text-gray-600 active:bg-gray-50"
              >
                <Settings className="h-5 w-5 text-gray-400 shrink-0" />
                Automatizaciones
              </Link>
              <Link
                href="/settings/users"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-3 px-5 py-3.5 text-sm text-gray-600 active:bg-gray-50"
              >
                <UserCog className="h-5 w-5 text-gray-400 shrink-0" />
                Usuarios
              </Link>
            </div>

            <div className="border-t border-gray-100 py-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
              <button
                onClick={() => {
                  setProfileOpen(false)
                  signOut({ callbackUrl: "/login" })
                }}
                className="flex items-center gap-3 px-5 py-3.5 text-sm text-red-500 w-full active:bg-red-50"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
