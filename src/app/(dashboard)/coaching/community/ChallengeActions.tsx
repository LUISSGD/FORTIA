"use client"

import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { api } from "@/components/coaching/kit"

export default function ChallengeActions({ id, isActive, showRanking }: { id: string; isActive: boolean; showRanking: boolean }) {
  const router = useRouter()
  const patch = async (data: object) => { await api(`/api/coaching/challenges/${id}`, "PATCH", data); router.refresh() }
  return (
    <div className="flex items-center gap-2 text-xs">
      <button className="text-gray-500 hover:text-gray-900" onClick={() => patch({ showRanking: !showRanking })}>{showRanking ? "Ocultar ranking" : "Mostrar ranking"}</button>
      <button className="text-gray-500 hover:text-gray-900" onClick={() => patch({ isActive: !isActive })}>{isActive ? "Finalizar" : "Reactivar"}</button>
      <button className="text-gray-400 hover:text-red-500" onClick={async () => { if (confirm("¿Eliminar reto?")) { await api(`/api/coaching/challenges/${id}`, "DELETE"); router.refresh() } }}><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  )
}
