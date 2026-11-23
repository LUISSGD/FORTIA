"use client"

import { useState } from "react"
import { UserCog, Plus, Trash2, RefreshCw, KeyRound } from "lucide-react"
import { toast } from "sonner"
import { STAFF_MODULES, type StaffModule } from "@/lib/staff-access"
import AccessModal from "./AccessModal"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

type User = {
  id: string
  name: string | null
  email: string
  role: string
  createdAt: Date | string
  modules: StaffModule[] | null // solo staff (USER)
}

const ROLE: Record<string, { label: string; cls: string; note: string }> = {
  ADMIN: { label: "Administrador", cls: "bg-orange-500 text-white", note: "Ve y administra todo" },
  NUTRITIONIST: { label: "Nutricionista", cls: "bg-green-100 text-green-700", note: "Solo el módulo de nutrición" },
  TRAINER: { label: "Entrenador EP", cls: "bg-sky-100 text-sky-700", note: "Solo el panel del entrenador" },
  USER: { label: "Staff", cls: "", note: "" },
}

export default function UsersClient({ users: initialUsers }: { users: User[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "USER" })
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<User | null>(null)

  async function handleCreate() {
    setError("")
    if (!form.name || !form.email || !form.password) {
      setError("Completa todos los campos")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: form.role }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Error al crear usuario")
        return
      }
      const newUser = await res.json()
      setUsers((prev) => [...prev, newUser])
      setForm({ name: "", email: "", password: "", role: "USER" })
      setOpen(false)
    } catch {
      setError("Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este usuario? Esta acción no se puede deshacer.")) return
    const res = await fetch(`/api/settings/users/${id}`, { method: "DELETE" })
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id))
    } else {
      toast.error("No se pudo eliminar el usuario")
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <UserCog className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Usuarios</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear usuario</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div>
                <Label>Contraseña</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div>
                <Label>Rol</Label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mt-1">
                  <option value="USER">Staff (acceso limitado a la app)</option>
                  <option value="NUTRITIONIST">Nutricionista (módulo de nutrición)</option>
                  <option value="TRAINER">Entrenador Personal (agenda EP y marcado de asistencia)</option>
                </select>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <p className="text-xs text-gray-500">
                {form.role === "NUTRITIONIST" ? "El nutricionista accede al panel en /nutrition con clientes, agenda y chat." : form.role === "TRAINER" ? "El entrenador accede al panel en /trainer con la agenda EP, marcado de asistencia y ficha de clientes." : "Entra con Hoy, Clientes, Entrena. Personal y Finanzas básicas. Después puedes cambiar sus accesos desde esta pantalla."}
              </p>
              <Button
                onClick={handleCreate}
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                Crear usuario
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ul className="divide-y rounded-lg border">
        {users.map((user) => {
          const role = ROLE[user.role] ?? ROLE.USER
          return (
            <li key={user.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1 basis-52">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{user.name ?? "—"}</span>
                  <Badge variant="secondary" className={role.cls}>{role.label}</Badge>
                </div>
                <p className="truncate text-xs text-gray-500">{user.email}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {user.modules ? (user.modules.length ? "Ve: " + STAFF_MODULES.filter((m) => user.modules!.includes(m.key)).map((m) => m.label).join(", ") : "Sin accesos") : role.note}
                </p>
              </div>
              {user.modules && (
                <button onClick={() => setEditing(user)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <KeyRound className="h-4 w-4 text-orange-500" />
                  Accesos
                </button>
              )}
              {user.role !== "ADMIN" && (
                <button onClick={() => handleDelete(user.id)} className="p-1.5 text-gray-400 transition-colors hover:text-red-500" title="Eliminar usuario" aria-label={"Eliminar a " + (user.name ?? user.email)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {users.length === 0 && <p className="text-center text-gray-500 py-8 text-sm">No hay usuarios registrados.</p>}

      {editing?.modules && (
        <AccessModal
          key={editing.id}
          user={{ id: editing.id, name: editing.name ?? editing.email, modules: editing.modules }}
          onClose={() => setEditing(null)}
          onSaved={(modules) => {
            setUsers((prev) => prev.map((u) => (u.id === editing.id ? { ...u, modules } : u)))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
