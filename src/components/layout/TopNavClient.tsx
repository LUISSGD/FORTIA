"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  ChevronDown,
  Bell,
  HeartPulse,
  Users,
  Trophy,
  Dumbbell,
  Play,
  Salad,
  FileText,
  Download,
  Calendar,
  BookOpen,
  DollarSign,
  CreditCard,
  Landmark,
  ClipboardList,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  LayoutDashboard,
  Settings,
  UserCog,
  LogOut,
} from "lucide-react"

type NavSubItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
}

type NavGroup = {
  label: string
  items: NavSubItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Clientes",
    items: [
      { href: "/coaching/clients", label: "Coaching", icon: HeartPulse },
      { href: "/clients", label: "Gimnasio", icon: Users },
      { href: "/coaching/community", label: "Comunidad", icon: Trophy },
    ],
  },
  {
    label: "Librería",
    items: [
      { href: "/coaching/programs", label: "Rutinas", icon: Dumbbell },
      { href: "/coaching/exercises", label: "Ejercicios", icon: Play },
      { href: "/coaching/nutrition", label: "Nutrición coaching", icon: Salad },
      { href: "/coaching/documents", label: "Documentos", icon: FileText },
      { href: "/coaching/import", label: "Importar", icon: Download },
      { href: "/training-plans", label: "Entrena. Personal", icon: Dumbbell },
      { href: "/nutrition", label: "Nutrición gym", icon: Salad },
    ],
  },
  {
    label: "Agenda",
    items: [
      { href: "/coaching/agenda", label: "Agenda coaching", icon: Calendar },
      { href: "/schedule", label: "Calendario", icon: Calendar },
      { href: "/classes", label: "Clases", icon: BookOpen },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { href: "/finances", label: "Resumen", icon: DollarSign, exact: true },
      { href: "/memberships", label: "Membresías", icon: CreditCard },
      { href: "/debts", label: "Deudas", icon: Landmark },
      { href: "/finances/monthly-expenses", label: "Gastos", icon: ClipboardList },
      { href: "/finances/pending-accumulated", label: "Acumulados", icon: AlertCircle },
      { href: "/finances/proyeccion", label: "Proyección", icon: TrendingUp },
      { href: "/coaching/payments", label: "Mensualidades", icon: CreditCard },
      { href: "/coaching/messages", label: "Mensajes", icon: MessageSquare },
    ],
  },
]

const USER_MENU: NavSubItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/coaching/automations", label: "Automatizaciones", icon: Settings },
  { href: "/settings/users", label: "Usuarios", icon: UserCog },
]

type Props = {
  expiringCount: number
  initials: string
  name: string | null
}

function isItemActive(item: NavSubItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href
  return pathname.startsWith(item.href)
}

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => isItemActive(item, pathname))
}

export default function TopNavClient({ expiringCount, initials, name }: Props) {
  const pathname = usePathname()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <header
      ref={navRef}
      className="hidden md:flex bg-white border-b border-gray-100 sticky top-0 z-50 h-14 items-center px-6 gap-2"
    >
      {/* Logo */}
      <Link href="/coaching" className="flex items-center gap-2 shrink-0 mr-6">
        <Image src="/logo.png" alt="FORTIA" width={30} height={30} className="rounded-lg" />
        <span className="text-sm font-bold text-gray-900 tracking-widest uppercase">FORTIA</span>
      </Link>

      {/* Nav groups */}
      <nav className="flex items-center gap-0.5 flex-1">
        {NAV_GROUPS.map((group) => {
          const active = isGroupActive(group, pathname)
          const isOpen = openMenu === group.label
          return (
            <div
              key={group.label}
              className="relative"
              onMouseEnter={() => setOpenMenu(group.label)}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <button
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors",
                  active
                    ? "font-semibold text-gray-900"
                    : "font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                )}
                onClick={() => setOpenMenu(isOpen ? null : group.label)}
              >
                {group.label}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-150",
                    isOpen && "rotate-180"
                  )}
                />
              </button>

              {isOpen && (
                <div className="absolute top-full left-0 pt-1 z-50 min-w-52">
                <div className="rounded-xl shadow-lg bg-white border border-gray-100 py-1">
                  {group.items.map((item) => {
                    const itemActive = isItemActive(item, pathname)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenMenu(null)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                          itemActive
                            ? "text-gray-900 font-medium bg-gray-50"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Right side: Bell + Avatar */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Bell */}
        <Link
          href="/dashboard"
          className="relative p-2 rounded-md hover:bg-gray-50 transition-colors"
        >
          <Bell className="h-5 w-5 text-gray-500" />
          {expiringCount > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 flex items-center justify-center text-[9px] font-bold bg-orange-500 text-white rounded-full">
              {expiringCount > 9 ? "9+" : expiringCount}
            </span>
          )}
        </Link>

        {/* Avatar + User dropdown */}
        <div
          className="relative"
          onMouseEnter={() => setOpenMenu("user")}
          onMouseLeave={() => setOpenMenu(null)}
        >
          <button
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
            onClick={() => setOpenMenu(openMenu === "user" ? null : "user")}
          >
            <div className="h-7 w-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            {name && (
              <span className="text-sm text-gray-700 hidden lg:block max-w-28 truncate">
                {name}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>

          {openMenu === "user" && (
            <div className="absolute top-full right-0 pt-1 z-50 min-w-48">
            <div className="rounded-xl shadow-lg bg-white border border-gray-100 py-1">
              {USER_MENU.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpenMenu(null)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={() => {
                    setOpenMenu(null)
                    signOut({ callbackUrl: "/login" })
                  }}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors w-full"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Cerrar sesión
                </button>
              </div>
            </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
