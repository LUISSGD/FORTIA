"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Megaphone } from "lucide-react"
import { Btn, Field, Modal, Textarea, api } from "@/components/coaching/kit"

export default function Broadcast({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  async function send() {
    try {
      const r = await api<{ sent: number }>("/api/coaching/messages/broadcast", "POST", { body: text, clientIds: selected })
      toast.success(`Enviado a ${r.sent} clientes`)
      setOpen(false)
      setText("")
      setSelected([])
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  return (
    <>
      <Btn variant="outline" onClick={() => setOpen(true)}><Megaphone className="h-4 w-4" /> Mensaje masivo</Btn>
      <Modal open={open} onClose={() => setOpen(false)} title="Mensaje masivo">
        <div className="space-y-3">
          <Field label="Mensaje" hint="Usa {nombre} para personalizar. Ej: ¡Hola {nombre}! Esta semana empezamos el reto…">
            <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <p className="text-xs text-gray-500">{selected.length ? `${selected.length} seleccionados` : "Se enviará a todos los clientes activos"}</p>
          <div className="max-h-52 overflow-y-auto border rounded-lg divide-y">
            {clients.map((c) => (
              <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <input type="checkbox" checked={selected.includes(c.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))} />
                {c.name}
              </label>
            ))}
          </div>
          <Btn className="w-full" onClick={send} disabled={!text.trim()}>Enviar</Btn>
        </div>
      </Modal>
    </>
  )
}
