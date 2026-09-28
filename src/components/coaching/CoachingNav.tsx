"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/coaching", label: "📊 Dashboard" },
  { href: "/coaching/clients", label: "👥 Clientes" },
  { href: "/coaching/programs", label: "🏋️ Rutinas" },
  { href: "/coaching/exercises", label: "🎥 Ejercicios" },
  { href: "/coaching/nutrition", label: "🥗 Nutrición" },
  { href: "/coaching/agenda", label: "📅 Agenda" },
  { href: "/coaching/payments", label: "💳 Pagos" },
  { href: "/coaching/messages", label: "💬 Mensajes" },
  { href: "/coaching/documents", label: "📄 Documentos" },
  { href: "/coaching/community", label: "🏆 Comunidad" },
  { href: "/coaching/automations", label: "⚙️ Automatizaciones" },
  { href: "/coaching/import", label: "📥 Importar" },
]

export default function CoachingNav() {
  const pathname = usePathname()
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-14 md:top-16 z-30">
      <div className="flex gap-1 overflow-x-auto px-3 md:px-6 py-2 no-scrollbar">
        {ITEMS.map((it) => {
          const active = it.href === "/coaching" ? pathname === it.href : pathname.startsWith(it.href)
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              {it.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
