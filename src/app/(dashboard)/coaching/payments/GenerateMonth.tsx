"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Btn, api } from "@/components/coaching/kit"

export default function GenerateMonth({ period, missing }: { period: string; missing: number }) {
  const router = useRouter()
  return (
    <Btn
      disabled={!missing}
      onClick={async () => {
        try {
          const r = await api<{ created: number }>("/api/coaching/payments", "POST", { generate: true, period })
          toast.success(`${r.created} mensualidades generadas`)
          router.refresh()
        } catch (e) {
          toast.error((e as Error).message)
        }
      }}
    >
      {missing ? `Generar mensualidades (${missing})` : "Mensualidades generadas ✓"}
    </Btn>
  )
}
