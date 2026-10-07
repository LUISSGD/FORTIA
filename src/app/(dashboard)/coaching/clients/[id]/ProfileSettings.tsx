"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { GOALS, LEVELS, PROFILE_STATUS } from "@/lib/coaching/constants"
import { estimateTdee } from "@/lib/coaching/nutrition"
import { Btn, Field, Input, Panel, Select, Textarea, api } from "@/components/coaching/kit"
import { whatsappUrl } from "@/lib/utils"

type P = {
  status: string; goal: string | null; level: string | null; sex: string | null; heightCm: number | null; startWeight: number | null; targetWeight: number | null
  trainingDays: number; startDate: string; calTarget: number | null; proteinTarget: number | null; carbsTarget: number | null; fatTarget: number | null; waterTargetMl: number
  planName: string | null; price: number | null; currency: string; billingDay: number; coachNotes: string | null; injuries: string | null
  phone: string; email: string; birthDate: string
}

const toStr = (v: unknown) => (v === null || v === undefined ? "" : String(v))

/** Contraseña fácil de dictar y escribir en el celular: "fortia" + 4 números. */
function easyPassword() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 9000 + 1000
  return `fortia${n}`
}

function welcomeMessage(firstName: string, email: string, password: string) {
  return [
    `¡Hola ${firstName}! 💪 Ya tienes tu acceso a la app de FORTIA: ahí verás tu rutina con videos, tu agenda de clases y podrás escribirme.`,
    "",
    `👉 Entra aquí: ${window.location.origin}/login`,
    `📧 Usuario: ${email}`,
    `🔑 Contraseña: ${password}`,
    "",
    "📲 Tip: ábrela en el celular y elige \"Agregar a pantalla de inicio\" (en iPhone, desde el botón Compartir de Safari) para tenerla como una app más.",
  ].join("\n")
}

export default function ProfileSettings({ clientId, firstName, profile, accessEmail, defaultEmail }: { clientId: string; firstName: string; profile: P; accessEmail: string | null; defaultEmail: string | null }) {
  const router = useRouter()
  const [f, setF] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(profile).map(([k, v]) => [k, toStr(v)])))
  const [saving, setSaving] = useState(false)
  const [access, setAccess] = useState({ email: accessEmail ?? defaultEmail ?? "", password: "" })
  // Datos recién creados para enviarlos al cliente (solo en pantalla; la contraseña no se vuelve a mostrar)
  const [invite, setInvite] = useState<{ email: string; password: string } | null>(null)
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }))

  const age = f.birthDate ? Math.floor((Date.now() - new Date(f.birthDate).getTime()) / 31_557_600_000) : null
  const tdee = estimateTdee({ weight: Number(f.startWeight) || null, heightCm: Number(f.heightCm) || null, age, sex: f.sex, trainingDays: Number(f.trainingDays) })

  function suggestMacros() {
    if (!tdee) return toast.error("Completa peso inicial, altura y fecha de nacimiento")
    const goal = f.goal.toLowerCase()
    const kcal = goal.includes("grasa") ? tdee - 450 : goal.includes("músculo") || goal.includes("hipertrofia") ? tdee + 250 : tdee
    const weight = Number(f.targetWeight) || Number(f.startWeight)
    const protein = Math.round(weight * 2)
    const fat = Math.round(weight * 0.9)
    const carbs = Math.max(50, Math.round((kcal - protein * 4 - fat * 9) / 4))
    setF((x) => ({ ...x, calTarget: String(Math.round(kcal / 10) * 10), proteinTarget: String(protein), fatTarget: String(fat), carbsTarget: String(carbs) }))
  }

  async function save() {
    setSaving(true)
    try {
      await api(`/api/coaching/clients/${clientId}`, "PATCH", f)
      toast.success("Perfil actualizado")
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function saveAccess() {
    try {
      await api(`/api/coaching/clients/${clientId}/access`, "POST", access)
      toast.success(accessEmail ? "Acceso actualizado" : "Acceso creado. Envíaselo a tu cliente por WhatsApp.")
      if (access.password) setInvite({ email: access.email.trim().toLowerCase(), password: access.password })
      setAccess((a) => ({ ...a, password: "" }))
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function revoke() {
    if (!confirm("¿Quitar el acceso a la app? El cliente no podrá iniciar sesión.")) return
    await api(`/api/coaching/clients/${clientId}/access`, "DELETE")
    toast.success("Acceso revocado")
    router.refresh()
  }

  async function end() {
    if (!confirm("¿Finalizar el coaching de este cliente? Se conserva su historial y se revoca su acceso.")) return
    await api(`/api/coaching/clients/${clientId}`, "DELETE")
    toast.success("Coaching finalizado")
    router.push("/coaching/clients")
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Panel title="Perfil de coaching" className="lg:col-span-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Estado">
            <Select value={f.status} onChange={(e) => set("status", e.target.value)}>
              {Object.entries(PROFILE_STATUS).filter(([k]) => k !== "ENDED").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Objetivo" className="col-span-2">
            <Select value={f.goal} onChange={(e) => set("goal", e.target.value)}>
              {[...new Set([f.goal, ...GOALS])].filter(Boolean).map((g) => <option key={g}>{g}</option>)}
            </Select>
          </Field>
          <Field label="Nivel">
            <Select value={f.level} onChange={(e) => set("level", e.target.value)}>
              <option value="">—</option>
              {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Sexo">
            <Select value={f.sex} onChange={(e) => set("sex", e.target.value)}>
              <option value="">—</option><option value="M">Masculino</option><option value="F">Femenino</option>
            </Select>
          </Field>
          <Field label="Fecha de nacimiento"><Input type="date" value={f.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></Field>
          <Field label="Teléfono"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Email de contacto"><Input value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Altura (cm)"><Input type="number" value={f.heightCm} onChange={(e) => set("heightCm", e.target.value)} /></Field>
          <Field label="Peso inicial"><Input type="number" step="0.1" value={f.startWeight} onChange={(e) => set("startWeight", e.target.value)} /></Field>
          <Field label="Peso objetivo"><Input type="number" step="0.1" value={f.targetWeight} onChange={(e) => set("targetWeight", e.target.value)} /></Field>
          <Field label="Días entreno/sem"><Input type="number" min={1} max={7} value={f.trainingDays} onChange={(e) => set("trainingDays", e.target.value)} /></Field>
          <Field label="Fecha de inicio"><Input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Objetivos nutricionales diarios</p>
            <Btn size="sm" variant="outline" onClick={suggestMacros}>Sugerir {tdee ? `(mantenimiento ≈ ${tdee} kcal)` : ""}</Btn>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Field label="Kcal"><Input type="number" value={f.calTarget} onChange={(e) => set("calTarget", e.target.value)} /></Field>
            <Field label="Proteína (g)"><Input type="number" value={f.proteinTarget} onChange={(e) => set("proteinTarget", e.target.value)} /></Field>
            <Field label="Carbohidratos (g)"><Input type="number" value={f.carbsTarget} onChange={(e) => set("carbsTarget", e.target.value)} /></Field>
            <Field label="Grasas (g)"><Input type="number" value={f.fatTarget} onChange={(e) => set("fatTarget", e.target.value)} /></Field>
            <Field label="Agua (ml)"><Input type="number" step={250} value={f.waterTargetMl} onChange={(e) => set("waterTargetMl", e.target.value)} /></Field>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3">
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-3">
          <Field label="Lesiones / limitaciones"><Textarea value={f.injuries} onChange={(e) => set("injuries", e.target.value)} /></Field>
          <Field label="Notas privadas del coach"><Textarea value={f.coachNotes} onChange={(e) => set("coachNotes", e.target.value)} /></Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Btn onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Btn>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="📱 Acceso a la app">
          <p className="text-xs text-gray-500 mb-3">
            {accessEmail ? <>El cliente entra con <b>{accessEmail}</b>. Puedes cambiar el email o resetear la contraseña.</> : "Crea el usuario con el que tu cliente iniciará sesión en la app."}
          </p>
          <div className="space-y-2">
            <Field label="Email"><Input type="email" value={access.email} onChange={(e) => setAccess((a) => ({ ...a, email: e.target.value }))} /></Field>
            <Field label={accessEmail ? "Nueva contraseña (opcional)" : "Contraseña (mín. 6)"}>
              <div className="flex gap-2">
                <Input value={access.password} onChange={(e) => setAccess((a) => ({ ...a, password: e.target.value }))} />
                <Btn variant="outline" size="sm" onClick={() => setAccess((a) => ({ ...a, password: easyPassword() }))}>Generar</Btn>
              </div>
            </Field>
            <div className="flex gap-2">
              <Btn onClick={saveAccess} className="flex-1">{accessEmail ? "Actualizar acceso" : "Crear acceso"}</Btn>
              {accessEmail && <Btn variant="danger" onClick={revoke}>Revocar</Btn>}
            </div>
            {invite && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-2 text-sm">
                <p className="text-emerald-800">✅ Listo. Envíale sus datos de acceso con el mensaje de bienvenida:</p>
                <a
                  href={whatsappUrl(f.phone, welcomeMessage(firstName, invite.email, invite.password))}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center rounded-lg bg-emerald-600 text-white font-semibold h-9"
                >
                  Enviar por WhatsApp
                </a>
                <button
                  onClick={() => navigator.clipboard.writeText(welcomeMessage(firstName, invite.email, invite.password)).then(() => toast.success("Mensaje copiado"))}
                  className="w-full text-xs text-emerald-700 underline"
                >
                  Copiar mensaje
                </button>
                {!f.phone && <p className="text-xs text-amber-700">No tiene teléfono registrado: WhatsApp te pedirá elegir el contacto.</p>}
              </div>
            )}
          </div>
        </Panel>
        <Panel title="Zona de peligro">
          <Btn variant="danger" onClick={end} className="w-full">Finalizar coaching</Btn>
        </Panel>
      </div>
    </div>
  )
}
