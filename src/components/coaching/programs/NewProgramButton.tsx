"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Btn, api } from "@/components/coaching/kit"

export default function NewProgramButton({ basePath = "/coaching" }: { basePath?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <Btn
      disabled={busy}
      onClick={async () => {
        const name = prompt("Nombre de la plantilla", "Push / Pull / Legs")
        if (!name) return
        setBusy(true)
        try {
          const p = await api<{ id: string }>("/api/coaching/programs", "POST", {
            name,
            days: [{ name: "Día 1", exercises: [] }],
          })
          router.push(`${basePath}/programs/${p.id}`)
        } catch (e) {
          toast.error((e as Error).message)
          setBusy(false)
        }
      }}
    >
      <Plus className="h-4 w-4" /> Nueva plantilla
    </Btn>
  )
}
