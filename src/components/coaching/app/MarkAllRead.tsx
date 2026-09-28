"use client"

import { useRouter } from "next/navigation"

export default function MarkAllRead() {
  const router = useRouter()
  return (
    <button
      className="text-xs text-orange-400 font-semibold mb-5"
      onClick={async () => {
        await fetch("/api/app/notifications", { method: "PATCH" })
        router.refresh()
      }}
    >
      Marcar todo como leído
    </button>
  )
}
