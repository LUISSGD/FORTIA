"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { staffNavItems } from "./staff-nav"

const MAX_TABS = 4

/** Menú inferior del staff: solo sus pantallas. Las que no caben abajo se abren desde Perfil. */
export default function StaffBottomNav({ modules, name, email }: { modules: string[]; name: string | null; email: string | null }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const items = staffNavItems(modules)
  const tabs = items.slice(0, MAX_TABS)
  const more = items.slice(MAX_TABS)
  const initials = name?.split(" ").map((n) => n[0]).slice(0, 2).join("") || "S"

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex">
          {tabs.map((item) => {
            const active = pathname === item.href || (!item.exact && pathname.startsWith(item.href + "/"))
            return (
              <Link key={item.href} href={item.href} className={cn("flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium transition-colors", active ? "text-gray-900" : "text-gray-400")}>
                <item.icon className="h-5 w-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            )
          })}
          <button onClick={() => setOpen(true)} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-gray-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">{initials}</span>
            Perfil
          </button>
        </div>
      </nav>

      {open && (
        <div className="md:hidden fixed inset-0 z-[60]" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-gray-100 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="h-1 w-10 rounded-full bg-gray-200" /></div>
            <div className="border-b border-gray-100 px-5 py-3">
              <p className="truncate text-sm font-semibold text-gray-900">{name}</p>
              <p className="truncate text-xs text-gray-400">{email}</p>
            </div>
            {more.length > 0 && (
              <div className="py-2">
                {more.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex items-center gap-3 px-5 py-3.5 text-sm text-gray-600 active:bg-gray-50">
                    <item.icon className="h-5 w-5 shrink-0 text-gray-400" />
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
            <div className="border-t border-gray-100 py-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
              <button onClick={() => { setOpen(false); signOut({ callbackUrl: "/login" }) }} className="flex w-full items-center gap-3 px-5 py-3.5 text-sm text-red-500 active:bg-red-50">
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
