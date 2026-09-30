"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { toast } from "sonner"
import { LogOut, KeyRound } from "lucide-react"
import { Card, darkInput } from "./ui"
import PushToggle from "@/components/coaching/PushToggle"

export default function ProfileActions() {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ current: "", next: "" })
  async function change() {
    const res = await fetch("/api/app/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) })
    const d = await res.json()
    if (!res.ok) return toast.error(d.error ?? "Error")
    toast.success("Contraseña actualizada")
    setOpen(false)
    setF({ current: "", next: "" })
  }
  return (
    <div className="space-y-3">
      <Card className="p-0">
        <PushToggle dark variant="banner" />
      </Card>
      <Card className="p-0">
        <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-700"><KeyRound className="h-4 w-4 text-gray-400" /> Cambiar contraseña</button>
        {open && (
          <div className="px-4 pb-4 space-y-2">
            <input type="password" className={darkInput} placeholder="Contraseña actual" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
            <input type="password" className={darkInput} placeholder="Nueva contraseña (mín. 6)" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
            <button onClick={change} className="w-full h-11 rounded-xl bg-orange-500 text-white font-bold">Guardar</button>
          </div>
        )}
      </Card>
      <button onClick={() => signOut({ callbackUrl: "/login" })} className="w-full h-12 rounded-xl border border-gray-200 text-gray-500 font-semibold flex items-center justify-center gap-2">
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </button>
    </div>
  )
}
