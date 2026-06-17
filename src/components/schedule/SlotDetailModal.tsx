"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { X, UserPlus } from "lucide-react"
import { DAYS_OF_WEEK } from "@/lib/utils"

interface Client {
  id: string
  firstName: string
  lastName: string
  phone?: string | null
}

interface Enrollment {
  id: string
  clientId: string
  client: Client
}

interface Slot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  instructor?: string | null
  class: { name: string; color: string; maxCapacity: number }
  enrollments: Enrollment[]
}

interface Props {
  slot: Slot | null
  open: boolean
  onClose: () => void
}

export default function SlotDetailModal({ slot, open, onClose }: Props) {
  const router = useRouter()
  const [enrollments, setEnrollments] = useState<Enrollment[]>(slot?.enrollments ?? [])
  const [allClients, setAllClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setEnrollments(slot?.enrollments ?? [])
      fetch("/api/clients").then((r) => r.json()).then(setAllClients)
    }
  }, [open, slot])

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

  if (!slot) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: slot.class.color }} />
            {slot.class.name} — {DAYS_OF_WEEK[slot.dayOfWeek]} {slot.startTime}
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-gray-500 space-y-1">
          <p>Horario: {slot.startTime} – {slot.endTime}</p>
          {slot.instructor && <p>Instructor: {slot.instructor}</p>}
          <p>Capacidad: {enrollments.length} / {slot.class.maxCapacity}</p>
        </div>

        {/* Enrolled list */}
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

        {/* Add client */}
        {enrollments.length < slot.class.maxCapacity && (
          <div className="flex gap-2 pt-2 border-t">
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
      </DialogContent>
    </Dialog>
  )
}
