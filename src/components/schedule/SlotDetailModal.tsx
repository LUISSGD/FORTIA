"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { X, UserPlus, Pencil, Trash2, Check, Dumbbell, ExternalLink, ClipboardCheck } from "lucide-react"
import Link from "next/link"
import { DAYS_OF_WEEK } from "@/lib/utils"
import type { Slot } from "./WeeklyGrid"

interface Client {
  id: string
  firstName: string
  lastName: string
  phone?: string | null
}

interface AttendanceRecord {
  clientId: string
  firstName: string
  lastName: string
  attended: boolean
}

interface Props {
  slot: Slot | null
  open: boolean
  onClose: () => void
}

type Tab = "inscritos" | "asistencia"

export default function SlotDetailModal({ slot, open, onClose }: Props) {
  const router = useRouter()
  const [enrollments, setEnrollments] = useState(slot?.enrollments ?? [])
  const [allClients, setAllClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState("")
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editForm, setEditForm] = useState({ startTime: "", endTime: "", instructor: "" })
  const [tab, setTab] = useState<Tab>("inscritos")
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)

  useEffect(() => {
    if (open && slot) {
      setEnrollments(slot.enrollments)
      setEditForm({ startTime: slot.startTime, endTime: slot.endTime, instructor: slot.instructor ?? "" })
      setEditing(false)
      setConfirmDelete(false)
      setTab("inscritos")
      if (!slot.isPT) {
        fetch("/api/clients").then((r) => r.json()).then(setAllClients)
      }
    }
  }, [open, slot])

  useEffect(() => {
    if (tab === "asistencia" && slot && !slot.isPT) {
      loadAttendance()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, attendanceDate, slot])

  async function loadAttendance() {
    if (!slot) return
    setAttendanceLoading(true)
    const res = await fetch(`/api/schedule/slots/${slot.id}/attendance?date=${attendanceDate}`)
    if (res.ok) setAttendance(await res.json())
    setAttendanceLoading(false)
  }

  async function toggleAttendance(clientId: string, current: boolean) {
    if (!slot) return
    const res = await fetch(`/api/schedule/slots/${slot.id}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, date: attendanceDate, attended: !current }),
    })
    if (res.ok) {
      setAttendance((prev) =>
        prev.map((a) => (a.clientId === clientId ? { ...a, attended: !current } : a))
      )
    }
  }

  const enrolledIds = new Set(enrollments.map((e) => e.clientId))
  const availableClients = allClients.filter((c) => !enrolledIds.has(c.id))

  async function addClient() {
    if (!selectedClientId || !slot) return
    setLoading(true)
    const res = await fetch(`/api/schedule/slots/${slot.id}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedClientId }),
    })
    setLoading(false)
    if (res.ok) {
      const enrollment = await res.json()
      setEnrollments((prev) => [...prev, enrollment])
      setSelectedClientId("")
      toast.success("Cliente inscrito")
      router.refresh()
    } else {
      toast.error("Error al inscribir cliente")
    }
  }

  async function removeClient(clientId: string) {
    if (!slot) return
    const res = await fetch(`/api/schedule/slots/${slot.id}/enrollments/${clientId}`, { method: "DELETE" })
    if (res.ok) {
      setEnrollments((prev) => prev.filter((e) => e.clientId !== clientId))
      toast.success("Cliente desinscrito")
      router.refresh()
    } else {
      toast.error("Error al desinscribir")
    }
  }

  async function saveEdit() {
    if (!slot) return
    setLoading(true)
    const res = await fetch(`/api/schedule/slots/${slot.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    })
    setLoading(false)
    if (res.ok) {
      toast.success("Horario actualizado")
      setEditing(false)
      router.refresh()
      onClose()
    } else {
      toast.error("Error al actualizar")
    }
  }

  async function deleteSlot() {
    if (!slot) return
    setLoading(true)
    await fetch(`/api/schedule/slots/${slot.id}`, { method: "DELETE" })
    setLoading(false)
    toast.success("Horario eliminado")
    router.refresh()
    onClose()
  }

  async function deletePTSlot() {
    if (!slot || !slot.clientId || !slot.planId) return
    setLoading(true)
    const res = await fetch(
      `/api/clients/${slot.clientId}/training-plans/${slot.planId}/schedule?slotId=${slot.id}`,
      { method: "DELETE" }
    )
    setLoading(false)
    if (res.ok) {
      toast.success("Horario de PT eliminado")
      router.refresh()
      onClose()
    } else {
      toast.error("Error al eliminar")
    }
  }

  if (!slot) return null

  // PT slot view
  if (slot.isPT) {
    const client = slot.enrollments[0]?.client
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-orange-500" />
              Entrenamiento Personal
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2">
            <p className="text-gray-500">
              {DAYS_OF_WEEK[slot.dayOfWeek]} · {slot.startTime} – {slot.endTime}
            </p>
            {slot.instructor && (
              <p className="text-gray-500">Entrenador: <span className="font-medium text-gray-700">{slot.instructor}</span></p>
            )}
            {client && (
              <Link
                href={`/clients/${client.id}`}
                className="flex items-center gap-1 font-medium text-orange-600 hover:underline"
                onClick={onClose}
              >
                {client.firstName} {client.lastName}
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
          <div className="pt-2 border-t">
            {confirmDelete ? (
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" className="flex-1" onClick={deletePTSlot} disabled={loading}>
                  {loading ? "..." : "Confirmar eliminar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>No</Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-red-500 hover:text-red-600 gap-1"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />Quitar del calendario
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const presentCount = attendance.filter((a) => a.attended).length

  // Regular slot view
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: slot.class.color }} />
            {slot.class.name} — {DAYS_OF_WEEK[slot.dayOfWeek]}
          </DialogTitle>
        </DialogHeader>

        {/* Info / Edit form */}
        {editing ? (
          <div className="space-y-3 border rounded-lg p-3 bg-orange-50">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Inicio</Label>
                <Input type="time" value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Fin</Label>
                <Input type="time" value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Instructor</Label>
              <Input value={editForm.instructor} onChange={(e) => setEditForm({ ...editForm, instructor: e.target.value })} placeholder="Nombre del instructor" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 flex-1" onClick={saveEdit} disabled={loading}>
                <Check className="h-3.5 w-3.5 mr-1" />{loading ? "Guardando..." : "Guardar"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 space-y-1">
            <p>Horario: {slot.startTime} – {slot.endTime}</p>
            {slot.instructor && <p>Instructor: {slot.instructor}</p>}
            <p>Capacidad: {enrollments.length} / {slot.class.maxCapacity}</p>
          </div>
        )}

        {/* Action buttons */}
        {!editing && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />Editar
            </Button>
            {confirmDelete ? (
              <div className="flex gap-1 flex-1">
                <Button size="sm" variant="destructive" className="flex-1" onClick={deleteSlot} disabled={loading}>
                  {loading ? "..." : "Confirmar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>No</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600 gap-1" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />Eliminar
              </Button>
            )}
          </div>
        )}

        {/* Tabs */}
        {!editing && (
          <div className="border-t pt-3">
            <div className="flex gap-1 mb-3">
              <button
                onClick={() => setTab("inscritos")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === "inscritos" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}
              >
                Inscritos ({enrollments.length})
              </button>
              <button
                onClick={() => setTab("asistencia")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${tab === "asistencia" ? "bg-orange-500 text-white" : "text-gray-500 hover:bg-gray-100"}`}
              >
                <ClipboardCheck className="h-3.5 w-3.5" />Asistencia
              </button>
            </div>

            {/* Tab: Inscritos */}
            {tab === "inscritos" && (
              <>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {enrollments.length === 0 ? (
                    <p className="text-sm text-gray-400">Sin clientes inscritos.</p>
                  ) : (
                    enrollments.map((e) => (
                      <div key={e.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                        <span className="text-sm">{e.client.firstName} {e.client.lastName}</span>
                        <button onClick={() => removeClient(e.clientId)} className="text-red-400 hover:text-red-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {enrollments.length < slot.class.maxCapacity && (
                  <div className="flex gap-2 pt-3 border-t mt-3">
                    <Select value={selectedClientId} onValueChange={(v) => setSelectedClientId(v ?? "")}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Agregar cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={addClient} disabled={!selectedClientId || loading} className="bg-orange-500 hover:bg-orange-600">
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Tab: Asistencia */}
            {tab === "asistencia" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Fecha</Label>
                  <Input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="text-sm h-8"
                  />
                  {attendance.length > 0 && (
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {presentCount}/{attendance.length} presentes
                    </span>
                  )}
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {attendanceLoading ? (
                    <p className="text-sm text-gray-400 text-center py-3">Cargando...</p>
                  ) : attendance.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-3">Sin clientes inscritos.</p>
                  ) : (
                    attendance.map((a) => (
                      <button
                        key={a.clientId}
                        onClick={() => toggleAttendance(a.clientId, a.attended)}
                        className={`w-full flex items-center justify-between rounded px-3 py-2 text-sm transition-colors ${
                          a.attended
                            ? "bg-green-50 border border-green-200 text-green-800"
                            : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <span>{a.firstName} {a.lastName}</span>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${a.attended ? "bg-green-500" : "bg-gray-200"}`}>
                          {a.attended && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
