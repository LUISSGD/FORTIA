"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, Users, LogOut, Dumbbell, ListChecks, Sun } from "lucide-react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import PushToggle from "@/components/coaching/PushToggle"

const NAV = [
  { href: "/trainer/hoy", icon: Sun, label: "Hoy" },
  { href: "/trainer/agenda", icon: Calendar, label: "Agenda" },
  { href: "/trainer/clients", icon: Users, label: "Clientes" },
  { href: "/trainer/programs", icon: ListChecks, label: "Rutinas" },
  { href: "/trainer/exercises", icon: Dumbbell, label: "Ejercicios" },
] as const

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 h-12 flex items-center justify-between gap-4 px-4">
        <span className="text-sm font-bold tracking-widest uppercase text-gray-900 shrink-0">
          FORTIA <span className="text-orange-500">Coach</span>
        </span>
        {/* Navegación en escritorio */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm", isActive(href) ? "bg-orange-50 text-orange-600 font-medium" : "text-gray-600 hover:bg-gray-50")}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <PushToggle variant="button" />
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </header>
      <main className="flex-1 pb-20 md:pb-6">{children}</main>
      {/* Navegación en móvil */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 flex h-16 z-40">
        {NAV.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium", isActive(href) ? "text-orange-500" : "text-gray-400")}>
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
