"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
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
        <span className="text-xs font-medium text-gray-700">
          {s.isRescheduled ? "↩ " : ""}S{s.sessionNumber}
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

export default function TrainerClientSessions({ sessions }: { sessions: Session[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-gray-500 uppercase">Sesiones</p>
      {sessions.map((s) => (
        <SessionRow key={s.sessionId} s={s} />
      ))}
    </div>
  )
}
