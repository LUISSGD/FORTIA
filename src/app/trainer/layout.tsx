"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, Users, LogOut } from "lucide-react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"

function Tab({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  const pathname = usePathname()
  const active = pathname.startsWith(href)
  return (
    <Link href={href} className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-orange-500" : "text-gray-400")}>
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  )
}

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 h-12 flex items-center justify-between px-4">
        <span className="text-sm font-bold tracking-widest uppercase text-gray-900">
          FORTIA <span className="text-orange-500">EP</span>
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
          Salir
        </button>
      </header>
      <div className="flex-1 pb-16">{children}</div>
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 flex h-16 z-40">
        <Tab href="/trainer/agenda" icon={Calendar} label="Agenda" />
        <Tab href="/trainer/clients" icon={Users} label="Clientes" />
      </nav>
    </div>
  )
}
