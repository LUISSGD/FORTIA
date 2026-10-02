"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

type Session = {
  sessionId: string
  sessionNumber: number
  scheduledDate: string | null
  attended: boolean | null
  isRescheduled: boolean
}

async function patchSession(sessionId: string, body: object) {
  const res = await fetch(`/api/trainer/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j.error ?? "Error al guardar")
  }
  return res.json()
}

function SessionRow({ s }: { s: Session }) {
  const router = useRouter()
  const [editDate, setEditDate] = useState(false)
  const [dateVal, setDateVal] = useState(s.scheduledDate ?? "")
  const [saving, setSaving] = useState(false)

  const canEdit = s.attended === null

  async function act(body: object) {
    setSaving(true)
    try {
      await patchSession(s.sessionId, body)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
      setEditDate(false)
    }
  }

  const statusColor = s.attended === true ? "bg-green-50 border-green-100" : s.attended === false ? "bg-red-50 border-red-100" : "bg-white border-gray-100"

  return (
    <div className={cn("rounded-lg border px-3 py-2 space-y-1.5", statusColor)}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-xs font-medium", s.isRescheduled ? "text-sky-600" : "text-gray-700")}>
          {s.isRescheduled ? "↩ " : ""}S{s.sessionNumber}
          {s.isRescheduled && <span className="ml-1 text-[10px] text-sky-400">Reprog.</span>}
        </span>

        {/* Fecha */}
        {editDate && canEdit ? (
          <div className="flex items-center gap-1 flex-1 justify-end">
            <input
              type="date"
              value={dateVal}
              onChange={(e) => setDateVal(e.target.value)}
              className="border border-gray-200 rounded px-2 py-0.5 text-xs"
            />
            <button
              disabled={saving || !dateVal}
              onClick={() => act({ scheduledDate: dateVal })}
              className="text-xs px-2 py-0.5 bg-gray-900 text-white rounded disabled:opacity-40"
            >
              OK
            </button>
            <button onClick={() => setEditDate(false)} className="text-xs text-gray-400">×</button>
          </div>
        ) : (
          <button
            disabled={!canEdit}
            onClick={() => canEdit && setEditDate(true)}
            className={cn("text-xs", canEdit ? "text-sky-600 hover:underline" : "text-gray-400 cursor-default")}
          >
            {s.scheduledDate ? s.scheduledDate.split("-").reverse().join("/") : "Sin fecha"}
          </button>
        )}

        {/* Asistencia */}
        {s.attended !== null ? (
          <div className="flex items-center gap-1">
            <span className="text-xs">{s.attended ? "✅" : "❌"}</span>
            <button
              disabled={saving}
              onClick={() => act({ attended: null })}
              className="text-[10px] text-gray-400 hover:text-gray-600 disabled:opacity-40"
            >
              deshacer
            </button>
          </div>
        ) : (
          <div className="flex gap-1">
            <button
              disabled={saving}
              onClick={() => act({ attended: true })}
              className="text-xs px-2 py-0.5 bg-green-50 border border-green-200 text-green-700 rounded hover:bg-green-100 disabled:opacity-40"
            >
              ✅
            </button>
            <button
              disabled={saving}
              onClick={() => act({ attended: false })}
              className="text-xs px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 rounded hover:bg-red-100 disabled:opacity-40"
            >
              ❌
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TrainerClientSessions({
  sessions,
  clientId,
  planId,
}: {
  sessions: Session[]
  clientId: string
  planId: string
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [newDate, setNewDate] = useState("")
  const [saving, setSaving] = useState(false)

  async function addRescheduled() {
    if (!newDate) return
    setSaving(true)
    try {
      const res = await fetch(`/api/trainer/clients/${clientId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, scheduledDate: newDate }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? "Error al agregar")
      }
      toast.success("Clase de reprogramación agregada")
      setAdding(false)
      setNewDate("")
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase">Sesiones</p>
        <button
          onClick={() => { setAdding(!adding); setNewDate("") }}
          className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700"
        >
          <Plus className="h-3 w-3" />
          Reprogramación
        </button>
      </div>

      {/* Formulario para agregar reprogramación */}
      {adding && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 space-y-2">
          <p className="text-xs font-medium text-sky-700">↩ Nueva clase de reprogramación</p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs bg-white"
            />
            <button
              disabled={saving || !newDate}
              onClick={addRescheduled}
              className="text-xs px-3 py-1 bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-40 font-medium"
            >
              Agregar
            </button>
            <button onClick={() => setAdding(false)} className="text-xs text-gray-400 hover:text-gray-600">
              ×
            </button>
          </div>
        </div>
      )}

      {sessions.map((s) => (
        <SessionRow key={s.sessionId} s={s} />
      ))}
    </div>
  )
}
