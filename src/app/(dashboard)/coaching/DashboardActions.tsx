"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BookOpen, Zap, CheckCheck } from "lucide-react"
import { Btn, api } from "@/components/coaching/kit"

export default function DashboardActions({ libraryEmpty }: { libraryEmpty: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key)
    try {
      toast.success(await fn())
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {libraryEmpty && (
        <Btn
          disabled={!!busy}
          onClick={() =>
            run("lib", async () => {
              const r = await api<{ exercises: number; foods: number }>("/api/coaching/library", "POST")
              return `Biblioteca cargada: ${r.exercises} ejercicios y ${r.foods} alimentos`
            })
          }
        >
          <BookOpen className="h-4 w-4" /> Cargar biblioteca base
        </Btn>
      )}
      <Btn
        variant="outline"
        disabled={!!busy}
        onClick={() =>
          run("auto", async () => {
            const r = await api<{ sent: number }>("/api/coaching/automations/run", "POST")
            return r.sent ? `${r.sent} mensajes automáticos enviados` : "Automatizaciones al día, nada que enviar"
          })
        }
      >
        <Zap className="h-4 w-4" /> Ejecutar automatizaciones
      </Btn>
      <Btn
        variant="ghost"
        disabled={!!busy}
        onClick={() =>
          run("read", async () => {
            await api("/api/coaching/notifications", "PATCH")
            return "Notificaciones marcadas como leídas"
          })
        }
      >
        <CheckCheck className="h-4 w-4" /> Marcar leído
      </Btn>
    </div>
  )
}
