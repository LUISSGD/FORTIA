"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Search, User, Calendar, AlertCircle, TrendingDown, TrendingUp, Minus } from "lucide-react"

type Consultation = {
  id: string
  date: string
  weight: number | null
  nextAppointment: string | null
  isPaid: boolean
  goal: string | null
  consultationNumber: number
}

type Client = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  currentGoal: string | null
  isActive: boolean
  consultations: Consultation[]
}

type Stats = {
  totalActive: number
  consultationsThisMonth: number
  upcomingAppointments: number
  pendingPayments: number
}

const GOAL_LABELS: Record<string, string> = {
  PERDIDA_PESO: "Pérdida de peso",
  GANANCIA_MUSCULAR: "Ganancia muscular",
  MANTENIMIENTO: "Mantenimiento",
  DEFINICION: "Definición",
  SALUD: "Salud general",
}

const GOAL_COLORS: Record<string, string> = {
  PERDIDA_PESO: "bg-blue-100 text-blue-700",
  GANANCIA_MUSCULAR: "bg-green-100 text-green-700",
  MANTENIMIENTO: "bg-gray-100 text-gray-700",
  DEFINICION: "bg-purple-100 text-purple-700",
  SALUD: "bg-teal-100 text-teal-700",
}

function AppointmentStatus({ nextAppointment }: { nextAppointment: string | null }) {
  if (!nextAppointment) return <span className="text-xs text-gray-400">Sin próxima cita</span>
  const date = new Date(nextAppointment)
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  const formatted = date.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })

  if (diffDays < 0)
    return <span className="text-xs text-red-500">Vencida: {formatted}</span>
  if (diffDays <= 3)
    return <span className="text-xs font-medium text-orange-500">Mañana o hoy: {formatted}</span>
  if (diffDays <= 7)
    return <span className="text-xs text-orange-400">Esta semana: {formatted}</span>
  return <span className="text-xs text-gray-500">{formatted}</span>
}

export default function NutritionListClient({ clients, stats }: { clients: Client[]; stats: Stats }) {
  const [search, setSearch] = useState("")
  const [filterGoal, setFilterGoal] = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  const now = new Date()

  const filtered = clients.filter((c) => {
    const name = `${c.firstName} ${c.lastName}`.toLowerCase()
    if (search && !name.includes(search.toLowerCase())) return false
    if (filterGoal && c.currentGoal !== filterGoal) return false
    if (filterStatus === "activo" && !c.isActive) return false
    if (filterStatus === "inactivo" && c.isActive) return false
    if (filterStatus === "sin-cita" && c.consultations[0]?.nextAppointment) return false
    if (filterStatus === "pago-pendiente" && (c.consultations.length === 0 || c.consultations[0].isPaid)) return false
    return true
  })

  return (
    <main className="flex-1 p-3 md:p-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Clientes activos</p>
          <p className="text-2xl font-bold text-gray-800">{stats.totalActive}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Consultas este mes</p>
          <p className="text-2xl font-bold text-green-600">{stats.consultationsThisMonth}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Citas próx. 7 días</p>
          <p className="text-2xl font-bold text-orange-500">{stats.upcomingAppointments}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Pagos pendientes</p>
          <p className="text-2xl font-bold text-red-500">{stats.pendingPayments}</p>
        </div>
      </div>

      {/* Upcoming appointments alert */}
      {(() => {
        const upcoming = clients.filter((c) => {
          const next = c.consultations[0]?.nextAppointment
          if (!next) return false
          const d = new Date(next)
          const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          return diff >= 0 && diff <= 3
        })
        if (upcoming.length === 0) return null
        return (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm font-medium text-orange-700 flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4" />
              {upcoming.length} cita(s) en los próximos 3 días:
            </p>
            <div className="flex flex-wrap gap-2">
              {upcoming.map((c) => (
                <Link key={c.id} href={`/nutrition/${c.id}`} className="text-xs text-orange-600 underline">
                  {c.firstName} {c.lastName}
                </Link>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Header + filters */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">
          Pacientes ({filtered.length})
        </h2>
        <Link href="/nutrition/new">
          <Button className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo paciente
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar paciente..."
            className="pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 w-44"
          />
        </div>
        <select
          value={filterGoal}
          onChange={(e) => setFilterGoal(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
        >
          <option value="">Todos los objetivos</option>
          {Object.entries(GOAL_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
          <option value="sin-cita">Sin próxima cita</option>
          <option value="pago-pendiente">Pago pendiente</option>
        </select>
      </div>

      {/* Client cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No se encontraron pacientes.</p>
          <Link href="/nutrition/new" className="text-sm text-green-600 underline mt-1 block">
            Registrar primer paciente
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const last = c.consultations[0]
            const goal = c.currentGoal ?? last?.goal ?? null
            return (
              <Link key={c.id} href={`/nutrition/${c.id}`}>
                <div className={`bg-white border rounded-xl p-4 hover:border-green-400 hover:shadow-sm transition-all cursor-pointer ${!c.isActive ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-800 leading-tight">
                        {c.firstName} {c.lastName}
                      </p>
                      {c.phone && <p className="text-xs text-gray-400 mt-0.5">{c.phone}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {!c.isActive && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                      )}
                      {goal && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${GOAL_COLORS[goal] ?? "bg-gray-100 text-gray-600"}`}>
                          {GOAL_LABELS[goal] ?? goal}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-2 mt-2">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {last
                        ? `Última: ${new Date(last.date).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}`
                        : "Sin consultas"}
                    </div>
                    {last?.weight && (
                      <div className="flex items-center gap-1 font-medium text-gray-700">
                        {last.weight} kg
                      </div>
                    )}
                  </div>

                  <div className="mt-1.5">
                    <AppointmentStatus nextAppointment={last?.nextAppointment ?? null} />
                  </div>

                  {last && !last.isPaid && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      Pago pendiente (consulta #{last.consultationNumber})
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
