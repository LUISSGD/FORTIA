"use client"

import { signOut } from "next-auth/react"
import { Lock } from "lucide-react"

export default function SinAccesoPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
      <Lock className="h-8 w-8 text-gray-300" />
      <h1 className="text-lg font-bold text-gray-900">No tienes pantallas asignadas</h1>
      <p className="max-w-xs text-sm text-gray-500">Pídele al administrador de FORTIA que active tus accesos.</p>
      <button onClick={() => signOut({ callbackUrl: "/login" })} className="mt-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700">Cerrar sesión</button>
    </main>
  )
}
