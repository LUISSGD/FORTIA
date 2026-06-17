"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface DeleteButtonProps {
  url: string
  label?: string
  confirm?: string
  onDeleted?: () => void
  variant?: "icon" | "text"
}

export default function DeleteButton({
  url,
  label = "Eliminar",
  confirm = "¿Estás seguro de que deseas eliminar este registro?",
  onDeleted,
  variant = "icon",
}: DeleteButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!window.confirm(confirm)) return
    setLoading(true)
    try {
      const res = await fetch(url, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar")
      toast.success("Eliminado correctamente")
      if (onDeleted) onDeleted()
      else router.refresh()
    } catch {
      toast.error("No se pudo eliminar")
    } finally {
      setLoading(false)
    }
  }

  if (variant === "text") {
    return (
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={loading}
      >
        <Trash2 className="h-4 w-4 mr-1" />
        {loading ? "Eliminando..." : label}
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      disabled={loading}
      className="text-red-500 hover:text-red-700 hover:bg-red-50"
      title={label}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}
