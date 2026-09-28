"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Btn, api } from "@/components/coaching/kit"

export default function NewMealPlanButton() {
  const router = useRouter()
  return (
    <Btn
      onClick={async () => {
        const name = prompt("Nombre de la plantilla", "Déficit 2000 kcal")
        if (!name) return
        try {
          const p = await api<{ id: string }>("/api/coaching/meal-plans", "POST", { name })
          router.push(`/coaching/nutrition/${p.id}`)
        } catch (e) {
          toast.error((e as Error).message)
        }
      }}
    >
      <Plus className="h-4 w-4" /> Nueva plantilla
    </Btn>
  )
}
