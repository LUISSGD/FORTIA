"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import { Dumbbell, CheckCircle2, PauseCircle, PlayCircle, ChevronRight, RotateCcw, CalendarDays, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AssignTrainingPlanDialog from "./AssignTrainingPlanDialog"
import { ENTRENADOR_LABELS, MODALIDAD_LABELS, TARIFA_LABELS } from "@/lib/training-pricing"
import type { Entrenador, Modalidad, Tarifa } from "@/lib/training-pricing"

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

interface TrainingSession {
  id: string
  sessionNumber: number
  packNumber: number
  completedAt: string
}

interface ScheduleSlot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
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
  scheduleSlots?: ScheduleSlot[]
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

function formatSchedule(slots: ScheduleSlot[]) {
  if (!slots || slots.length === 0) return null
  const byTime: Record<string, number[]> = {}
  for (const s of slots) {
    const key = `${s.startTime}–${s.endTime}`
    byTime[key] = byTime[key] ?? []
    byTime[key].push(s.dayOfWeek)
  }
  return Object.entries(byTime).map(([time, days]) => {
    const dayStr = days.sort((a, b) => a - b).map(d => DAY_LABELS[d]).join(" · ")
    return `${dayStr} ${time}`
  }).join(" | ")
}

interface ScheduleDialogProps {
  planId: string
  clientId: string
  slots: ScheduleSlot[]
  onUpdate: (slots: ScheduleSlot[]) => void
}

function ScheduleDialog({ planId, clientId, slots, onUpdate }: ScheduleDialogProps) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [startTime, setStartTime] = useState("07:00")
  const [endTime, setEndTime] = useState("08:00")
  const [saving, setSaving] = useState(false)

  function toggleDay(d: number) {
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  async function addSlots() {
    if (selectedDays.length === 0 || !startTime || !endTime) {
      toast.error("Selecciona al menos un día y el horario")
      return
    }
    setSaving(true)
    const results: ScheduleSlot[] = []
    for (const day of selectedDays) {
      const res = await fetch(`/api/clients/${clientId}/training-plans/${planId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: day, startTime, endTime }),
      })
      if (res.ok) results.push(await res.json())
    }
    setSaving(false)
    onUpdate([...slots, ...results])
    setSelectedDays([])
    setAdding(false)
    toast.success(`${results.length} día(s) agregado(s)`)
  }

  async function removeSlot(slotId: string) {
    const res = await fetch(`/api/clients/${clientId}/training-plans/${planId}/schedule?slotId=${slotId}`, {
      method: "DELETE",
    })
    if (res.ok) {
      onUpdate(slots.filter(s => s.id !== slotId))
      toast.success("Día eliminado")
    }
  }

  return (
    <>
      <button
        className="text-xs text-gray-400 hover:text-orange-500 flex items-center gap-1"
        onClick={() => setOpen(true)}
      >
        <CalendarDays className="h-3 w-3" />
        {slots.length > 0 ? "Editar horario" : "Agregar horario"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-orange-500" />
              Horario semanal
            </DialogTitle>
          </DialogHeader>

          {slots.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">Sin horario asignado</p>
          ) : (
            <div className="space-y-1">
              {slots.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-xs">
                  <span className="font-medium">{DAY_LABELS[s.dayOfWeek]}</span>
                  <span className="text-gray-500">{s.startTime} – {s.endTime}</span>
                  <button onClick={() => removeSlot(s.id)} className="text-red-400 hover:text-red-600 ml-2">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {adding ? (
            <div className="space-y-3 border rounded-lg p-3 bg-orange-50">
              <div className="flex flex-wrap gap-1">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${
                      selectedDays.includes(i)
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Inicio</Label>
                  <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Fin</Label>
                  <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 bg-orange-500 hover:bg-orange-600 h-7 text-xs" onClick={addSlots} disabled={saving}>
                  {saving ? "Guardando..." : "Agregar"}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setAdding(true)}>
              <Plus className="h-3 w-3" />Agregar día
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function PersonalTrainingSection({ clientId, initialPlans }: Props) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [marking, setMarking] = useState<string | null>(null)
  const [undoing, setUndoing] = useState<string | null>(null)

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
      setPlans(prev => prev.map(p => p.id === planId ? { ...updated, scheduleSlots: p.scheduleSlots } : p))
      toast.success("Clase marcada")
    } else {
      const err = await res.json()
      toast.error(err.error ?? "Error")
    }
  }

  async function undoSession(planId: string) {
    setUndoing(planId)
    const res = await fetch(`/api/clients/${clientId}/training-plans/${planId}/sessions`, {
      method: "DELETE",
    })
    setUndoing(null)
    if (res.ok) {
      const updated = await res.json()
      setPlans(prev => prev.map(p => p.id === planId ? { ...updated, scheduleSlots: p.scheduleSlots } : p))
      toast.success("Clase desmarcada")
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

  function updateScheduleSlots(planId: string, slots: ScheduleSlot[]) {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, scheduleSlots: slots } : p))
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
          const scheduleLabel = formatSchedule(plan.scheduleSlots ?? [])

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

              {/* Schedule info */}
              <div className="flex items-center justify-between">
                {scheduleLabel ? (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {scheduleLabel}
                  </p>
                ) : (
                  <span />
                )}
                <ScheduleDialog
                  planId={plan.id}
                  clientId={clientId}
                  slots={plan.scheduleSlots ?? []}
                  onUpdate={(slots) => updateScheduleSlots(plan.id, slots)}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1 flex-wrap">
                {plan.status === "ACTIVE" && (
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 h-7 text-xs"
                    onClick={() => markSession(plan.id)}
                    disabled={marking === plan.id || undoing === plan.id}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {marking === plan.id ? "..." : "Marcar clase"}
                  </Button>
                )}
                {plan.sessionsCompleted > 0 && (plan.status === "ACTIVE" || plan.status === "PAUSED") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-gray-500"
                    onClick={() => undoSession(plan.id)}
                    disabled={marking === plan.id || undoing === plan.id}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    {undoing === plan.id ? "..." : "Deshacer"}
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
