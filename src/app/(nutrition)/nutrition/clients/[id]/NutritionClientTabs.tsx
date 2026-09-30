"use client"

import { useState } from "react"
import Link from "next/link"
import { ChefHat, Stethoscope, CalendarDays, MessageSquare, ArrowLeft, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import ChatPanel, { type ChatMessage } from "@/components/coaching/ChatPanel"

type Consultation = { id: string; date: string; notes: string; weight: number | null }
type Booking = { id: string; startsAt: Date; endsAt: Date; title: string; status: string }
type MealPlan = { id: string; name: string; isActive: boolean; createdAt: Date }

type ClientData = {
  id: string
  firstName: string
  lastName: string
  goal: string | null
  calTarget: number | null
  proteinTarget: number | null
  consultations: Consultation[]
}

const TABS = [
  { key: "plan", label: "Plan nutricional", icon: ChefHat },
  { key: "consultations", label: "Consultas", icon: Stethoscope },
  { key: "agenda", label: "Agenda", icon: CalendarDays },
  { key: "chat", label: "Chat", icon: MessageSquare },
]

const fmtDate = (d: Date | string) =>
  new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d))

export default function NutritionClientTabs({
  client,
  messages,
  bookings,
  mealPlans,
  initialTab,
}: {
  client: ClientData
  messages: ChatMessage[]
  bookings: Booking[]
  mealPlans: MealPlan[]
  initialTab: string
}) {
  const [tab, setTab] = useState(initialTab)

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/nutrition/clients" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600 shrink-0">
          {client.firstName[0]}{client.lastName?.[0] ?? ""}
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{client.firstName} {client.lastName}</h1>
          {client.goal && <p className="text-xs text-gray-400">{client.goal}</p>}
        </div>
        {(client.calTarget || client.proteinTarget) && (
          <div className="ml-auto flex gap-2 text-xs text-gray-500">
            {client.calTarget && <span className="bg-orange-50 text-orange-600 px-2 py-1 rounded-full">{client.calTarget} kcal</span>}
            {client.proteinTarget && <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-full">{client.proteinTarget}g prot</span>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === key ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Plan tab */}
      {tab === "plan" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{mealPlans.length} plan(es) creados</p>
            <Link href={`/coaching/nutrition/new?clientId=${client.id}`} className="flex items-center gap-1.5 text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600">
              <Plus className="h-4 w-4" /> Nuevo plan
            </Link>
          </div>
          {mealPlans.length === 0 && <p className="text-gray-400 text-sm py-6 text-center">Aún no hay planes para este cliente.</p>}
          <div className="space-y-2">
            {mealPlans.map((p) => (
              <Link key={p.id} href={`/coaching/nutrition/${p.id}`} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50">
                <ChefHat className={cn("h-5 w-5 shrink-0", p.isActive ? "text-green-500" : "text-gray-300")} />
                <span className="flex-1 text-sm font-medium text-gray-900">{p.name}</span>
                {p.isActive && <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">Activo</span>}
                <span className="text-xs text-gray-400">{fmtDate(p.createdAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Consultations tab */}
      {tab === "consultations" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{client.consultations.length} consulta(s)</p>
            <Link href={`/coaching/clients/${client.id}?tab=nutrition`} className="text-sm text-orange-500 hover:underline">
              Ver en ficha de coaching →
            </Link>
          </div>
          {client.consultations.length === 0 && <p className="text-gray-400 text-sm py-6 text-center">Aún no hay consultas registradas.</p>}
          <div className="space-y-2">
            {client.consultations.map((c) => (
              <div key={c.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm font-semibold text-gray-900">{new Date(c.date).toLocaleDateString("es-PE")}</span>
                  {c.weight && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{c.weight} kg</span>}
                </div>
                {c.notes && <p className="text-sm text-gray-500 whitespace-pre-wrap">{c.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agenda tab */}
      {tab === "agenda" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{bookings.filter((b) => new Date(b.startsAt) >= new Date()).length} cita(s) próximas</p>
            <Link href="/nutrition/agenda" className="text-sm text-orange-500 hover:underline">
              Gestionar agenda →
            </Link>
          </div>
          {bookings.length === 0 && <p className="text-gray-400 text-sm py-6 text-center">Sin citas agendadas.</p>}
          <div className="space-y-2">
            {bookings.map((b) => {
              const past = new Date(b.startsAt) < new Date()
              return (
                <div key={b.id} className={cn("flex items-center gap-3 border rounded-xl px-4 py-3", past ? "bg-gray-50 border-gray-100" : "bg-white border-gray-200")}>
                  <CalendarDays className={cn("h-5 w-5 shrink-0", past ? "text-gray-300" : "text-orange-500")} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", past ? "text-gray-400" : "text-gray-900")}>{b.title}</p>
                    <p className="text-xs text-gray-400">{fmtDate(b.startsAt)}</p>
                  </div>
                  {past && <span className="text-xs text-gray-400">Pasada</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Chat tab */}
      {tab === "chat" && (
        <div className="h-[calc(100vh-13rem)] flex flex-col border border-gray-200 rounded-xl overflow-hidden">
          <ChatPanel
            mode="nutritionist"
            clientId={client.id}
            initialMessages={messages}
            channel="NUTRITION"
            className="flex-1 min-h-0"
          />
        </div>
      )}
    </div>
  )
}
