"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Btn, Modal, api } from "@/components/coaching/kit"
import { DEFAULT_STAFF_MODULES, STAFF_MODULES, type StaffModule } from "@/lib/staff-access"
import { cn } from "@/lib/utils"

const GROUPS = ["Clientes", "Finanzas", "Otros"] as const

/** Interruptores de las pantallas que puede abrir una cuenta del staff. */
export default function AccessModal({ user, onClose, onSaved }: {
  user: { id: string; name: string; modules: StaffModule[] }
  onClose: () => void
  onSaved: (modules: StaffModule[]) => void
}) {
  const [on, setOn] = useState<StaffModule[]>(user.modules)
  const [saving, setSaving] = useState(false)
  const toggle = (key: StaffModule) => setOn((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  async function save() {
    setSaving(true)
    try {
      const r = await api<{ modules: StaffModule[] }>(`/api/settings/users/${user.id}`, "PATCH", { modules: on })
      toast.success("Accesos guardados. Valen desde ahora.")
      onSaved(r.modules)
    } catch (e) {
      toast.error((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Accesos de ${user.name}`}>
      <p className="mb-3 text-xs text-gray-500">Lo que apagues deja de verse y de abrirse al instante, también sus datos. 🔒 = información delicada del negocio o de los clientes.</p>
      <div className="space-y-4">
        {GROUPS.map((group) => (
          <section key={group}>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{group}</h4>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {STAFF_MODULES.filter((m) => m.group === group).map((m) => {
                const active = on.includes(m.key)
                return (
                  <li key={m.key}>
                    <button type="button" role="switch" aria-checked={active} onClick={() => toggle(m.key)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-900">{m.label}{"sensitive" in m && m.sensitive ? " 🔒" : ""}</span>
                        <span className="block text-xs text-gray-500">{m.hint}</span>
                      </span>
                      <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", active ? "bg-orange-500" : "bg-gray-200")}>
                        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", active ? "left-[18px]" : "left-0.5")} />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500">Cobranza, Interesados, Coaching y Usuarios son siempre solo del administrador.</p>
      <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 flex items-center gap-2 border-t border-gray-100 bg-white p-4">
        <button type="button" onClick={() => setOn(DEFAULT_STAFF_MODULES)} className="mr-auto text-xs text-gray-500 underline">Volver a lo normal</button>
        <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Btn>
      </div>
    </Modal>
  )
}
