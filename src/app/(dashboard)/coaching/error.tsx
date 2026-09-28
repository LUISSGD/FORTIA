"use client"

import { useEffect } from "react"

// Muestra un error legible dentro del panel de coaching en lugar de la pantalla genérica.
export default function CoachingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error])
  return (
    <div className="max-w-xl mx-auto mt-10 rounded-xl border border-red-200 bg-red-50 p-5 text-sm space-y-3">
      <p className="font-semibold text-red-700">No se pudo cargar esta sección.</p>
      <p className="text-red-700 break-words">{error.message}</p>
      {error.digest && <p className="text-xs text-red-500">Código: {error.digest}</p>}
      <button onClick={reset} className="h-9 px-4 rounded-lg bg-red-600 text-white font-medium">Reintentar</button>
    </div>
  )
}
