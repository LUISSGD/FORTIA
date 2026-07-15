"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import { Dumbbell, CheckCircle2, PauseCircle, PlayCircle, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import AssignTrainingPlanDialog from "./AssignTrainingPlanDialog"
import { ENTRENADOR_LABELS, MODALIDAD_LABELS, TARIFA_LABELS } from "@/lib/training-pricing"
import type { Entrenador, Modalidad, Tarifa } from "@/lib/training-pricing"

interface TrainingSession {
  id: string
  sessionNumber: number
  packNumber: number
  completedAt: string
}

interface Plan {
  id: string
  modalidad: string
  tipoEntrenador: string
  tarifa: string
  numPacks: number
  clasesPerPack: number
  pricePaid: number
  sessionsCompleted: number
  currentPackStart: string | null
  status: string
  notes: string | null
  createdAt: string
  sessions: TrainingSession[]
}

interface Props {
  clientId: string
  initialPlans: Plan[]
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  COMPLETED: "Completado",
  PAUSED: "Pausado",
  CANCELLED: "Cancelado",
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  PAUSED: "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-gray-100 text-gray-500",
}

function fmt(n: number) {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`
}

export default function PersonalTrainingSection({ clientId, initialPlans }: Props) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [marking, setMarking] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/training-plans`)
    if (res.ok) setPlans(await res.json())
  }, [clientId])

  async function markSession(planId: string) {
    setMarking(planId)
    const res = await fetch(`/api/clients/${clientId}/training-plans/${planId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    setMarking(null)
    if (res.ok) {
      const updated = await res.json()
      setPlans(prev => prev.map(p => p.id === planId ? updated : p))
      toast.success("Clase marcada")
    } else {
      const err = await res.json()
      toast.error(err.error ?? "Error")
    }
  }

  async function toggleStatus(plan: Plan) {
    const newStatus = plan.status === "ACTIVE" ? "PAUSED" : "ACTIVE"
    const res = await fetch(`/api/clients/${clientId}/training-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: newStatus } : p))
      toast.success(newStatus === "PAUSED" ? "Plan pausado" : "Plan reactivado")
    }
  }

  const activePlans = plans.filter(p => p.status === "ACTIVE" || p.status === "PAUSED")
  const pastPlans = plans.filter(p => p.status === "COMPLETED" || p.status === "CANCELLED")

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-orange-500" />
          <h3 className="font-semibold text-gray-700 text-sm">Entrenamiento Personalizado</h3>
        </div>
        <AssignTrainingPlanDialog clientId={clientId} onAssigned={refresh} />
      </div>

      {plans.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">Sin planes asignados.</p>
      )}

      <div className="space-y-3">
        {activePlans.map(plan => {
          const totalClases = plan.numPacks * plan.clasesPerPack
          const currentPack = Math.min(Math.floor(plan.sessionsCompleted / plan.clasesPerPack) + 1, plan.numPacks)
          const sessionsInCurrentPack = plan.sessionsCompleted % plan.clasesPerPack
          const progressPct = plan.clasesPerPack > 0 ? (sessionsInCurrentPack / plan.clasesPerPack) * 100 : 0
          const isCompleted = plan.status === "COMPLETED"

          return (
            <div key={plan.id} className="border rounded-xl p-3 bg-white space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{MODALIDAD_LABELS[plan.modalidad as Modalidad] ?? plan.modalidad}</p>
                  <p className="text-xs text-gray-500">
                    {ENTRENADOR_LABELS[plan.tipoEntrenador as Entrenador] ?? plan.tipoEntrenador}
                    {" · "}{TARIFA_LABELS[plan.tarifa as Tarifa] ?? plan.tarifa}
                    {" · "}{fmt(plan.pricePaid)}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[plan.status]}`}>
                  {STATUS_LABELS[plan.status]}
                </span>
              </div>

              {/* Pack progress */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">
                    Pack {currentPack} de {plan.numPacks} · {sessionsInCurrentPack}/{plan.clasesPerPack} clases
                  </span>
                  <span className="text-xs text-gray-400">{plan.sessionsCompleted}/{totalClases} totales</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-orange-400 h-2 rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                {/* Pack dots */}
                {plan.numPacks > 1 && (
                  <div className="flex items-center gap-1 mt-1.5">
                    {Array.from({ length: plan.numPacks }).map((_, i) => {
                      const packSessions = Math.max(0, Math.min(plan.clasesPerPack, plan.sessionsCompleted - i * plan.clasesPerPack))
                      const isDone = packSessions >= plan.clasesPerPack
                      const isCurrent = i + 1 === currentPack && !isCompleted
                      return (
                        <div key={i} className="flex items-center gap-0.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isDone ? "bg-green-100 text-green-700" : isCurrent ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-400"}`}>
                            P{i + 1}
                          </span>
                          {i < plan.numPacks - 1 && <ChevronRight className="h-2.5 w-2.5 text-gray-300" />}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {plan.status === "ACTIVE" && (
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 h-7 text-xs"
                    onClick={() => markSession(plan.id)}
                    disabled={marking === plan.id}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {marking === plan.id ? "..." : "Marcar clase"}
                  </Button>
                )}
                {(plan.status === "ACTIVE" || plan.status === "PAUSED") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => toggleStatus(plan)}
                  >
                    {plan.status === "ACTIVE"
                      ? <><PauseCircle className="h-3 w-3 mr-1" />Pausar</>
                      : <><PlayCircle className="h-3 w-3 mr-1" />Reactivar</>
                    }
                  </Button>
                )}
              </div>

              {plan.notes && <p className="text-xs text-gray-400 italic">{plan.notes}</p>}
            </div>
          )
        })}

        {pastPlans.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
              Ver planes anteriores ({pastPlans.length})
            </summary>
            <div className="space-y-2 mt-2">
              {pastPlans.map(plan => (
                <div key={plan.id} className="border rounded-lg p-2.5 bg-gray-50 opacity-70">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">{MODALIDAD_LABELS[plan.modalidad as Modalidad] ?? plan.modalidad}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[plan.status]}`}>
                      {STATUS_LABELS[plan.status]}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {plan.sessionsCompleted}/{plan.numPacks * plan.clasesPerPack} clases · {fmt(plan.pricePaid)}
                  </p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
