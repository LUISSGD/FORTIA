"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export default function ClearDataButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClear() {
    if (
      !window.confirm(
        "¿Estás seguro? Esto eliminará TODOS los clientes, ingresos y egresos registrados. Esta acción no se puede deshacer."
      )
    )
      return

    setLoading(true)
    try {
      const res = await fetch("/api/admin/clear-data", { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Datos eliminados correctamente")
      router.refresh()
    } catch {
      toast.error("No se pudieron eliminar los datos")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClear}
      disabled={loading}
      className="text-red-600 border-red-200 hover:bg-red-50"
    >
      <Trash2 className="h-4 w-4 mr-1" />
      {loading ? "Eliminando..." : "Limpiar datos de ejemplo"}
    </Button>
  )
}
