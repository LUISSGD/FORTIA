"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  CreditCard,
  BookOpen,
  LogOut,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/schedule", label: "Calendario", icon: Calendar },
  { href: "/classes", label: "Clases", icon: BookOpen },
  { href: "/finances", label: "Finanzas", icon: DollarSign },
  { href: "/memberships", label: "Membresías", icon: CreditCard },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-64 bg-gray-900 text-white flex-col min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
        <Image src="/logo.png" alt="FORTIA" width={40} height={40} className="rounded-lg" />
        <span className="text-xl font-bold tracking-wide">FORTIA</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-orange-500 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
