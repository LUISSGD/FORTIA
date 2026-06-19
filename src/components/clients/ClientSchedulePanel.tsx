"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Calendar, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

interface Slot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  instructor?: string | null
  class: { id: string; name: string; color: string }
}

interface Enrollment {
  slotId: string
  slot: Slot
}

interface Props {
  clientId: string
  enrollments: Enrollment[]
  allSlots: Slot[]
}

export default function ClientSchedulePanel({ clientId, enrollments, allSlots }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const enrolledSlotIds = new Set(enrollments.map((e) => e.slotId))

  async function enroll(slotId: string) {
    setLoading(slotId)
    const res = await fetch(`/api/schedule/slots/${slotId}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    })
    setLoading(null)
    if (res.ok) {
      toast.success("Horario asignado")
      router.refresh()
    } else {
      toast.error("Error al asignar horario")
    }
  }

  async function unenroll(slotId: string) {
    setLoading(slotId)
    await fetch(`/api/schedule/slots/${slotId}/enrollments/${clientId}`, { method: "DELETE" })
    setLoading(null)
    toast.success("Horario removido")
    router.refresh()
  }

  const slotsByDay = DAYS.map((day, i) => ({
    day,
    slots: allSlots.filter((s) => s.dayOfWeek === i),
  }))

  return (
    <>
      <div className="space-y-2">
        {enrollments.length === 0 ? (
          <p className="text-sm text-gray-500">Sin horarios asignados.</p>
        ) : (
          enrollments.map((e) => (
            <div key={e.slotId} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.slot.class.color }} />
                <div>
                  <p className="text-sm font-medium">{e.slot.class.name}</p>
                  <p className="text-xs text-gray-500">
                    {DAYS[e.slot.dayOfWeek]} · {e.slot.startTime}–{e.slot.endTime}
                    {e.slot.instructor && ` · ${e.slot.instructor}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => unenroll(e.slotId)}
                disabled={loading === e.slotId}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
        <Button variant="outline" size="sm" className="w-full gap-1 mt-2" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Agregar horario
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Seleccionar horario
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {slotsByDay.map(({ day, slots }) => {
              if (!slots.length) return null
              return (
                <div key={day}>
                  <p className="text-xs font-semibold text-orange-600 uppercase mb-2">{day}</p>
                  <div className="space-y-1">
                    {slots.map((slot) => {
                      const enrolled = enrolledSlotIds.has(slot.id)
                      return (
                        <div key={slot.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${enrolled ? "bg-orange-50 border-orange-200" : "border-gray-200"}`}>
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slot.class.color }} />
                            <div>
                              <p className="text-sm font-medium">{slot.class.name}</p>
                              <p className="text-xs text-gray-500">{slot.startTime}–{slot.endTime}{slot.instructor && ` · ${slot.instructor}`}</p>
                            </div>
                          </div>
                          {enrolled ? (
                            <button
                              onClick={() => { unenroll(slot.id); setOpen(false) }}
                              disabled={loading === slot.id}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Quitar
                            </button>
                          ) : (
                            <button
                              onClick={() => { enroll(slot.id); setOpen(false) }}
                              disabled={loading === slot.id}
                              className="text-xs text-orange-500 hover:text-orange-700 font-medium"
                            >
                              + Agregar
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {allSlots.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No hay horarios creados en el calendario.<br />
                <span className="text-xs">Ve a Calendario para crear clases y horarios primero.</span>
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
