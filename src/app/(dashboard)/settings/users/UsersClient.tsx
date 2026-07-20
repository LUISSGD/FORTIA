"use client"

import { useState } from "react"
import { UserCog, Plus, Trash2, RefreshCw } from "lucide-react"
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
  createdAt: Date
}

export default function UsersClient({ users: initialUsers }: { users: User[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [error, setError] = useState("")

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
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Error al crear usuario")
        return
      }
      const newUser = await res.json()
      setUsers((prev) => [...prev, newUser])
      setForm({ name: "", email: "", password: "" })
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
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
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
              {error && <p className="text-sm text-red-500">{error}</p>}
              <p className="text-xs text-gray-500">
                El usuario tendrá acceso limitado: Clientes, Calendario y Finanzas (solo registro básico).
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

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Rol</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium">{user.name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant={user.role === "ADMIN" ? "default" : "secondary"}
                    className={user.role === "ADMIN" ? "bg-orange-500 text-white" : ""}
                  >
                    {user.role === "ADMIN" ? "Administrador" : "Usuario"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {user.role !== "ADMIN" && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="text-center text-gray-500 py-8 text-sm">No hay usuarios registrados.</p>
        )}
      </div>
    </div>
  )
}
