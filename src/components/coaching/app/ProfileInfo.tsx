"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil } from "lucide-react"
import { GOALS, LEVELS } from "@/lib/coaching/constants"
import { Card, SectionTitle, darkInput } from "./ui"

export type ProfileData = {
  phone: string
  birthDate: string // YYYY-MM-DD o ""
  sex: string // M | F | ""
  heightCm: string
  currentWeight: string
  targetWeight: string
  goal: string
  level: string
  trainingDays: string
  injuries: string
}

const SEX: Record<string, string> = { M: "Hombre", F: "Mujer" }

function age(ymd: string) {
  if (!ymd) return null
  const [y, m, d] = ymd.split("-").map(Number)
  const now = new Date()
  let a = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--
  return a
}

function birthday(ymd: string) {
  if (!ymd) return "—"
  const [, m, d] = ymd.split("-").map(Number)
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2000, m - 1, d)))
}

/** Datos personales del cliente con edición desde la app. */
export default function ProfileInfo({ initial, startDate, openOnLoad = false }: { initial: ProfileData; startDate: string | null; openOnLoad?: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(openOnLoad)
  const [f, setF] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof ProfileData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const missing = !initial.birthDate || !initial.phone || !initial.goal

  async function save() {
    // Solo se envían los campos que cambiaron
    const changes = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== initial[k as keyof ProfileData]))
    if (!Object.keys(changes).length) return setEditing(false)
    setSaving(true)
    try {
      const res = await fetch("/api/app/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? "No se pudo guardar")
      toast.success("Datos guardados")
      setEditing(false)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const label = "block text-xs font-semibold text-gray-500 mb-1"
  const years = age(initial.birthDate)

  return (
    <Card>
      <span id="datos" />
      <SectionTitle
        emoji="👤"
        action={!editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs font-semibold text-orange-500">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
        )}
      >
        Mis datos
      </SectionTitle>

      {!editing ? (
        <>
          {missing && (
            <button onClick={() => setEditing(true)} className="w-full text-left mb-3 rounded-xl bg-orange-50 border border-orange-200 p-3 text-xs text-orange-700">
              Completa tus datos para que tu coach pueda personalizar mejor tu plan →
            </button>
          )}
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-400">Objetivo</dt><dd>{initial.goal || "—"}</dd>
            <dt className="text-gray-400">Edad</dt><dd>{years !== null ? `${years} años` : "—"}</dd>
            <dt className="text-gray-400">Cumpleaños</dt><dd>{birthday(initial.birthDate)}</dd>
            <dt className="text-gray-400">Teléfono</dt><dd>{initial.phone || "—"}</dd>
            <dt className="text-gray-400">Sexo</dt><dd>{SEX[initial.sex] ?? "—"}</dd>
            <dt className="text-gray-400">Altura</dt><dd>{initial.heightCm ? `${initial.heightCm} cm` : "—"}</dd>
            <dt className="text-gray-400">Peso actual</dt><dd>{initial.currentWeight ? `${initial.currentWeight} kg` : "—"}</dd>
            <dt className="text-gray-400">Peso objetivo</dt><dd>{initial.targetWeight ? `${initial.targetWeight} kg` : "—"}</dd>
            <dt className="text-gray-400">Nivel</dt><dd>{LEVELS[initial.level] ?? "—"}</dd>
            <dt className="text-gray-400">Entrenos/semana</dt><dd>{initial.trainingDays || "—"}</dd>
            <dt className="text-gray-400">Inicio</dt><dd>{startDate ?? "—"}</dd>
          </dl>
          {initial.injuries && <p className="mt-3 text-xs bg-red-50 text-red-700 rounded-lg p-2">⚠️ {initial.injuries}</p>}
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className={label}>Fecha de nacimiento</label>
              <input type="date" className={darkInput} value={f.birthDate} onChange={set("birthDate")} max={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={label}>Teléfono / WhatsApp</label>
              <input type="tel" inputMode="tel" className={darkInput} placeholder="999 999 999" value={f.phone} onChange={set("phone")} />
            </div>
            <div>
              <label className={label}>Sexo</label>
              <select className={darkInput} value={f.sex} onChange={set("sex")}>
                <option value="">—</option>
                <option value="F">Mujer</option>
                <option value="M">Hombre</option>
              </select>
            </div>
            <div>
              <label className={label}>Altura (cm)</label>
              <input type="number" inputMode="decimal" className={darkInput} placeholder="170" value={f.heightCm} onChange={set("heightCm")} />
            </div>
            <div>
              <label className={label}>Peso actual (kg)</label>
              <input type="number" inputMode="decimal" step="0.1" className={darkInput} placeholder="70" value={f.currentWeight} onChange={set("currentWeight")} />
            </div>
            <div>
              <label className={label}>Peso objetivo (kg)</label>
              <input type="number" inputMode="decimal" step="0.1" className={darkInput} placeholder="65" value={f.targetWeight} onChange={set("targetWeight")} />
            </div>
            <div className="col-span-2">
              <label className={label}>Objetivo</label>
              <select className={darkInput} value={f.goal} onChange={set("goal")}>
                <option value="">Elegir…</option>
                {[...new Set([...(f.goal && !GOALS.includes(f.goal) ? [f.goal] : []), ...GOALS])].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Nivel</label>
              <select className={darkInput} value={f.level} onChange={set("level")}>
                <option value="">—</option>
                {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Entrenos por semana</label>
              <select className={darkInput} value={f.trainingDays} onChange={set("trainingDays")}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={String(n)}>{n}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={label}>Lesiones o molestias</label>
              <textarea className={`${darkInput} h-20 py-2`} placeholder="Ej.: molestia en rodilla derecha" value={f.injuries} onChange={set("injuries")} maxLength={500} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setF(initial); setEditing(false) }} className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-500 font-semibold">Cancelar</button>
            <button onClick={save} disabled={saving} className="flex-1 h-11 rounded-xl bg-orange-500 text-white font-bold disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>
      )}
    </Card>
  )
}
