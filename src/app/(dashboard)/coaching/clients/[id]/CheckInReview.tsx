"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Btn, Textarea, api } from "@/components/coaching/kit"

export default function CheckInReview({ id, reply, reviewed }: { id: string; reply: string | null; reviewed: boolean }) {
  const router = useRouter()
  const [text, setText] = useState(reply ?? "")
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try {
      await api(`/api/coaching/checkins/${id}`, "PATCH", { coachReply: text })
      toast.success(text ? "Respuesta enviada al cliente" : "Marcado como revisado")
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-2">
      <Textarea placeholder="Feedback para tu cliente (opcional)…" value={text} onChange={(e) => setText(e.target.value)} />
      <Btn size="sm" onClick={save} disabled={busy}>{reviewed ? "Actualizar respuesta" : text ? "Responder y marcar revisado" : "Marcar revisado"}</Btn>
    </div>
  )
}
