"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import {
  Dumbbell, PauseCircle, PlayCircle, ChevronRight, CalendarDays,
  Plus, Trash2, Pencil, CheckCircle2, XCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AssignTrainingPlanDialog from "./AssignTrainingPlanDialog"
import { ENTRENADOR_LABELS, MODALIDAD_LABELS, TARIFA_LABELS } from "@/lib/training-pricing"
import type { Entrenador, Modalidad, Tarifa } from "@/lib/training-pricing"

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

interface TrainingSession {
  id: string
  sessionNumber: number
  packNumber: number
  scheduledDate?: string | null
  completedAt?: string | null
  attended?: boolean | null
  isRescheduled?: boolean
  notes?: string | null
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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

function dayLabel(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
  return DAY_LABELS[dow]
}

function toInputValue(iso: string | null | undefined): string {
  if (!iso) return ""
  return iso.slice(0, 10)
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

/* ── Schedule Dialog (unchanged) ─────────────────────────────── */
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

/* ── Edit Plan Dialog (unchanged) ─────────────────────────────── */
interface EditDialogProps {
  plan: Plan
  clientId: string
  onSaved: (updated: Plan) => void
  onDeleted: (planId: string) => void
}

function EditPlanDialog({ plan, clientId, onSaved, onDeleted }: EditDialogProps) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(plan.notes ?? "")
  const [pricePaid, setPricePaid] = useState(String(plan.pricePaid))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function handleOpen() {
    setNotes(plan.notes ?? "")
    setPricePaid(String(plan.pricePaid))
    setConfirmDelete(false)
    setOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/training-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes || null, pricePaid: Number(pricePaid) }),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      onSaved({ ...updated, scheduleSlots: plan.scheduleSlots })
      toast.success("Plan actualizado")
      setOpen(false)
    } else {
      toast.error("Error al actualizar")
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/clients/${clientId}/training-plans/${plan.id}`, { method: "DELETE" })
    setDeleting(false)
    if (res.ok) {
      onDeleted(plan.id)
      toast.success("Plan eliminado")
      setOpen(false)
    } else {
      toast.error("Error al eliminar")
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button onClick={handleOpen} className="text-gray-400 hover:text-orange-500 p-0.5 rounded" title="Editar plan">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => { setConfirmDelete(true); setOpen(true) }} className="text-gray-400 hover:text-red-500 p-0.5 rounded" title="Eliminar plan">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmDelete ? "Eliminar plan" : "Editar plan"}</DialogTitle>
          </DialogHeader>

          {confirmDelete ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                ¿Seguro que quieres eliminar este plan? Se borrarán todas las clases registradas y el ingreso asociado.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Eliminando..." : "Sí, eliminar"}
                </Button>
                <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Precio pagado (S/)</Label>
                <Input
                  type="number"
                  value={pricePaid}
                  onChange={e => setPricePaid(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <Label>Notas</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observación..." />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ── Add Reschedule Dialog ─────────────────────────────────────── */
interface AddRescheduleProps {
  planId: string
  clientId: string
  onAdded: (updated: Plan) => void
}

function AddRescheduleDialog({ planId, clientId, onAdded }: AddRescheduleProps) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/training-plans/${planId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledDate: date || null }),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      onAdded(updated)
      toast.success("Sesión de reprogramación agregada")
      setDate("")
      setOpen(false)
    } else {
      toast.error("Error al agregar")
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-medium mt-1"
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar reprogramación
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Sesión de reprogramación</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Fecha (opcional)</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-orange-500 hover:bg-orange-600 h-8 text-xs" onClick={handleAdd} disabled={saving}>
                {saving ? "Guardando..." : "Agregar"}
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ── Session Row ───────────────────────────────────────────────── */
interface SessionRowProps {
  session: TrainingSession
  label: string
  planId: string
  clientId: string
  onUpdated: (updated: Plan) => void
}

function SessionRow({ session, label, planId, clientId, onUpdated }: SessionRowProps) {
  const [busy, setBusy] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [dateVal, setDateVal] = useState(toInputValue(session.scheduledDate))

  // Retrocompat: if attended null but completedAt set, treat as attended
  const effectiveAttended = session.attended ?? (session.completedAt ? true : null)

  async function patch(data: Record<string, unknown>) {
    setBusy(true)
    const res = await fetch(`/api/clients/${clientId}/training-plans/${planId}/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    setBusy(false)
    if (res.ok) {
      onUpdated(await res.json())
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "Error")
    }
  }

  async function saveDate() {
    await patch({ scheduledDate: dateVal || null })
    setEditingDate(false)
  }

  const displayDate = session.scheduledDate ?? session.completedAt
  const isRescheduled = session.isRescheduled

  return (
    <div className={`flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0 ${isRescheduled ? "bg-blue-50/40" : ""}`}>
      {/* Label */}
      <span className={`text-[11px] font-bold w-6 text-center shrink-0 ${
        isRescheduled ? "text-blue-600" : "text-gray-500"
      }`}>
        {label}
      </span>

      {/* Day */}
      <span className="text-[11px] text-gray-400 w-7 shrink-0">
        {dayLabel(displayDate)}
      </span>

      {/* Date */}
      <div className="flex-1 min-w-0">
        {effectiveAttended !== null ? (
          <span className="text-xs text-gray-500">{fmtDate(displayDate) || "—"}</span>
        ) : editingDate ? (
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={dateVal}
              onChange={e => setDateVal(e.target.value)}
              className="h-6 text-xs px-1.5 py-0"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") saveDate(); if (e.key === "Escape") setEditingDate(false) }}
            />
            <button onClick={saveDate} className="text-orange-500 hover:text-orange-600 text-[11px] font-medium">ok</button>
            <button onClick={() => setEditingDate(false)} className="text-gray-400 hover:text-gray-600 text-[11px]">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setEditingDate(true)}
            className="text-xs text-gray-400 hover:text-gray-700 text-left"
          >
            {fmtDate(session.scheduledDate) || <span className="italic text-gray-300">sin fecha</span>}
          </button>
        )}
      </div>

      {/* Attendance buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {effectiveAttended === true ? (
          <button
            onClick={() => patch({ attended: null })}
            disabled={busy}
            className="flex items-center gap-0.5 text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium hover:bg-green-200 transition-colors"
            title="Click para revertir"
          >
            <CheckCircle2 className="h-3 w-3" />
            Asistió
          </button>
        ) : effectiveAttended === false ? (
          <button
            onClick={() => patch({ attended: null })}
            disabled={busy}
            className="flex items-center gap-0.5 text-[11px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium hover:bg-red-200 transition-colors"
            title="Click para revertir"
          >
            <XCircle className="h-3 w-3" />
            No asistió
          </button>
        ) : (
          <>
            <button
              onClick={() => patch({ attended: true })}
              disabled={busy}
              className="text-[11px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {busy ? "..." : "Asistió"}
            </button>
            <button
              onClick={() => patch({ attended: false })}
              disabled={busy}
              className="text-[11px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              No asistió
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────────────── */
export default function PersonalTrainingSection({ clientId, initialPlans }: Props) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/training-plans`)
    if (res.ok) setPlans(await res.json())
  }, [clientId])

  function updatePlan(updated: Plan) {
    setPlans(prev => prev.map(p =>
      p.id === updated.id ? { ...updated, scheduleSlots: p.scheduleSlots ?? updated.scheduleSlots } : p
    ))
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

  function handlePlanSaved(updated: Plan) {
    setPlans(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  function handlePlanDeleted(planId: string) {
    setPlans(prev => prev.filter(p => p.id !== planId))
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
          const normalSessions = plan.sessions.filter(s => !s.isRescheduled)
          const rescheduledSessions = plan.sessions.filter(s => s.isRescheduled)
          const scheduleLabel = formatSchedule(plan.scheduleSlots ?? [])

          // Progress counts
          const attended = plan.sessions.filter(s => (s.attended ?? (s.completedAt ? true : null)) === true).length
          const missed = plan.sessions.filter(s => s.attended === false).length
          const pending = plan.sessions.filter(s => (s.attended ?? (s.completedAt ? true : null)) === null).length

          // Pack progress for header
          const currentPack = Math.min(Math.floor(plan.sessionsCompleted / plan.clasesPerPack) + 1, plan.numPacks)
          const isCompleted = plan.status === "COMPLETED"

          return (
            <div key={plan.id} className="border rounded-xl p-3 bg-white space-y-2">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{MODALIDAD_LABELS[plan.modalidad as Modalidad] ?? plan.modalidad}</p>
                  <p className="text-xs text-gray-500">
                    {ENTRENADOR_LABELS[plan.tipoEntrenador as Entrenador] ?? plan.tipoEntrenador}
                    {" · "}{TARIFA_LABELS[plan.tarifa as Tarifa] ?? plan.tarifa}
                    {" · "}{fmt(plan.pricePaid)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[plan.status]}`}>
                    {STATUS_LABELS[plan.status]}
                  </span>
                  <EditPlanDialog
                    plan={plan}
                    clientId={clientId}
                    onSaved={handlePlanSaved}
                    onDeleted={handlePlanDeleted}
                  />
                </div>
              </div>

              {/* Pack pills */}
              <div className="flex items-center gap-2">
                {plan.numPacks > 1 && (
                  <div className="flex items-center gap-1">
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
                <span className="text-xs text-gray-500 ml-auto">
                  <span className="text-green-600 font-medium">{attended}</span> asistidas
                  {" · "}
                  <span className="text-gray-400">{pending}</span> pendientes
                  {missed > 0 && <><span> · </span><span className="text-red-400">{missed}</span> no asistidas</>}
                </span>
              </div>

              {/* Schedule label */}
              <div className="flex items-center justify-between">
                {scheduleLabel ? (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {scheduleLabel}
                  </p>
                ) : <span />}
                <ScheduleDialog
                  planId={plan.id}
                  clientId={clientId}
                  slots={plan.scheduleSlots ?? []}
                  onUpdate={(slots) => updateScheduleSlots(plan.id, slots)}
                />
              </div>

              {/* Session table */}
              <div className="border rounded-lg overflow-hidden bg-gray-50/50">
                {/* Normal sessions */}
                <div className="px-2 pt-1">
                  {normalSessions.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2 text-center">Sin sesiones registradas</p>
                  ) : (
                    normalSessions.map((session) => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        label={`S${session.sessionNumber}`}
                        planId={plan.id}
                        clientId={clientId}
                        onUpdated={updatePlan}
                      />
                    ))
                  )}
                </div>

                {/* Rescheduled sessions */}
                {rescheduledSessions.length > 0 && (
                  <div className="px-2 border-t border-blue-100">
                    {rescheduledSessions.map((session, idx) => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        label={`R${idx + 1}`}
                        planId={plan.id}
                        clientId={clientId}
                        onUpdated={updatePlan}
                      />
                    ))}
                  </div>
                )}

                {/* Add reschedule button */}
                <div className="px-2 pb-2">
                  <AddRescheduleDialog
                    planId={plan.id}
                    clientId={clientId}
                    onAdded={updatePlan}
                  />
                </div>
              </div>

              {/* Plan actions */}
              <div className="flex gap-2 flex-wrap">
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

        {/* Past plans */}
        {pastPlans.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
              Ver planes anteriores ({pastPlans.length})
            </summary>
            <div className="space-y-2 mt-2">
              {pastPlans.map(plan => {
                const attended = plan.sessions.filter(s => (s.attended ?? (s.completedAt ? true : null)) === true).length
                const totalClases = plan.numPacks * plan.clasesPerPack
                return (
                  <div key={plan.id} className="border rounded-lg p-2.5 bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium">{MODALIDAD_LABELS[plan.modalidad as Modalidad] ?? plan.modalidad}</p>
                        <p className="text-[11px] text-gray-400">
                          {attended}/{totalClases} clases · {fmt(plan.pricePaid)}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[plan.status]}`}>
                        {STATUS_LABELS[plan.status]}
                      </span>
                    </div>
                    {/* Compact session list for past plans */}
                    {plan.sessions.length > 0 && (
                      <div className="mt-2 border rounded px-2 bg-white">
                        {plan.sessions.filter(s => !s.isRescheduled).map(s => (
                          <SessionRow
                            key={s.id}
                            session={s}
                            label={`S${s.sessionNumber}`}
                            planId={plan.id}
                            clientId={clientId}
                            onUpdated={updatePlan}
                          />
                        ))}
                        {plan.sessions.filter(s => s.isRescheduled).map((s, idx) => (
                          <SessionRow
                            key={s.id}
                            session={s}
                            label={`R${idx + 1}`}
                            planId={plan.id}
                            clientId={clientId}
                            onUpdated={updatePlan}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
