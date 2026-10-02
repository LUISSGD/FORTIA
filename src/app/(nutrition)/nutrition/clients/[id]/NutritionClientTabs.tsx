"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ChefHat, Stethoscope, CalendarDays, MessageSquare, ArrowLeft, Plus,
  LineChart as LineChartIcon, UtensilsCrossed, User2, Droplets, Scale,
  Flame, Beef, Wheat, Salad, CheckCircle2, XCircle, CreditCard, Pill,
  ClipboardList, ChevronDown, ChevronUp, Edit2, Save, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import ChatPanel, { type ChatMessage } from "@/components/coaching/ChatPanel"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"

// ─────────────────── Types ───────────────────
type Consultation = {
  id: string; date: string; consultationNumber: number
  weight: number | null; height: number | null; bodyFat: number | null
  muscleMass: number | null; visceralFat: number | null
  waist: number | null; hips: number | null; arms: number | null
  goal: string | null; calTarget: number | null
  proteinTarget: number | null; carbsTarget: number | null; fatTarget: number | null
  waterTarget: number | null; dietPlan: string | null
  supplements: string | null; recommendations: string | null; observations: string | null
  nextAppointment: string | null; isPaid: boolean; paymentAmount: number | null
}

type NutritionProfile = {
  id: string; gender: string | null; birthDate: string | null
  phone: string | null; email: string | null; occupation: string | null
  physicalActivityLevel: string | null; medicalConditions: string | null
  allergies: string | null; foodPreferences: string | null
  currentGoal: string | null; referredBy: string | null; notes: string | null
  isActive: boolean
}

type Booking = { id: string; startsAt: string; endsAt: string; title: string; status: string }
type MealPlan = { id: string; name: string; isActive: boolean; createdAt: string; calTarget: number | null; proteinTarget: number | null; carbsTarget: number | null; fatTarget: number | null }
type MealLog = { id: string; date: string; name: string; status: string; kcal: number; protein: number; carbs: number; fat: number; note: string | null }
type PhysicalRecord = { id: string; date: string; weight: number | null; bodyFat: number | null; waist: number | null; hips: number | null; arms: number | null }
type WaterLog = { date: string; ml: number }
type ClientData = { id: string; firstName: string; lastName: string; goal: string | null; calTarget: number | null; proteinTarget: number | null; carbsTarget: number | null; fatTarget: number | null; waterTargetMl: number }

const TABS = [
  { key: "plan", label: "Plan", icon: ChefHat },
  { key: "consultations", label: "Consultas", icon: Stethoscope },
  { key: "progress", label: "Progreso", icon: LineChartIcon },
  { key: "diary", label: "Diario", icon: UtensilsCrossed },
  { key: "profile", label: "Perfil clínico", icon: User2 },
  { key: "agenda", label: "Agenda", icon: CalendarDays },
  { key: "chat", label: "Chat", icon: MessageSquare },
]

const fmtDate = (d: Date | string) =>
  new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", year: "numeric", hour12: false }).format(new Date(d))

const fmtShort = (d: string) =>
  new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short" }).format(new Date(d))

const AVATAR_COLORS = [
  "from-orange-400 to-orange-500",
  "from-violet-400 to-purple-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-pink-500",
  "from-sky-400 to-blue-500",
]
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] }

// ─────────────────── MacroRing ───────────────────
function MacroPill({ label, value, unit, color }: { label: string; value: number | null; unit: string; color: string }) {
  if (!value) return null
  return (
    <span className={cn("flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full", color)}>
      {label}: {value}{unit}
    </span>
  )
}

// ─────────────────── Consultation Form ───────────────────
const EMPTY_FORM = {
  date: new Date().toISOString().split("T")[0],
  weight: "", height: "", bodyFat: "", muscleMass: "", visceralFat: "",
  waist: "", hips: "", arms: "",
  calTarget: "", proteinTarget: "", carbsTarget: "", fatTarget: "", waterTarget: "",
  observations: "", recommendations: "", supplements: "", dietPlan: "",
  nextAppointment: "", isPaid: false, paymentAmount: "",
}

function ConsultationForm({
  nutritionClientId, onSaved,
}: {
  nutritionClientId: string
  onSaved: (c: Consultation) => void
}) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr(null)
    try {
      const res = await fetch(`/api/nutrition/clients/${nutritionClientId}/consultations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await res.text())
      const saved = await res.json()
      onSaved({
        ...saved,
        date: saved.date,
        nextAppointment: saved.nextAppointment ?? null,
      })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900">Nueva consulta</h3>

      {/* Date */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</label>
        <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
          className="mt-1 block w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300" />
      </div>

      {/* Body measurements */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Medidas corporales</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[
            ["weight", "Peso (kg)"],
            ["height", "Talla (cm)"],
            ["bodyFat", "% Grasa"],
            ["muscleMass", "Masa muscular (kg)"],
            ["visceralFat", "Grasa visceral"],
            ["waist", "Cintura (cm)"],
            ["hips", "Cadera (cm)"],
            ["arms", "Brazo (cm)"],
          ].map(([k, label]) => (
            <div key={k}>
              <label className="text-[10px] text-gray-400 font-medium">{label}</label>
              <input
                type="number" step="0.1" value={(form as Record<string, unknown>)[k] as string}
                onChange={(e) => set(k, e.target.value)}
                className="mt-0.5 block w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Macro targets */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Metas nutricionales</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[
            ["calTarget", "Kcal/día"],
            ["proteinTarget", "Proteína (g)"],
            ["carbsTarget", "Carbos (g)"],
            ["fatTarget", "Grasas (g)"],
            ["waterTarget", "Agua (ml)"],
          ].map(([k, label]) => (
            <div key={k}>
              <label className="text-[10px] text-gray-400 font-medium">{label}</label>
              <input
                type="number" value={(form as Record<string, unknown>)[k] as string}
                onChange={(e) => set(k, e.target.value)}
                className="mt-0.5 block w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="grid sm:grid-cols-2 gap-2.5">
        {[
          ["observations", "Observaciones"],
          ["recommendations", "Recomendaciones"],
          ["supplements", "Suplementos"],
          ["dietPlan", "Plan de dieta (texto)"],
        ].map(([k, label]) => (
          <div key={k}>
            <label className="text-[10px] text-gray-400 font-medium">{label}</label>
            <textarea
              rows={3} value={(form as Record<string, unknown>)[k] as string}
              onChange={(e) => set(k, e.target.value)}
              className="mt-0.5 block w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 resize-none"
            />
          </div>
        ))}
      </div>

      {/* Payment */}
      <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.isPaid} onChange={(e) => set("isPaid", e.target.checked)}
            className="h-4 w-4 rounded accent-orange-500" />
          <span className="font-medium text-gray-700">Consulta pagada</span>
        </label>
        {form.isPaid && (
          <div className="flex-1">
            <input type="number" placeholder="Monto (S/)" value={form.paymentAmount}
              onChange={(e) => set("paymentAmount", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 bg-white" />
          </div>
        )}
      </div>

      {err && <p className="text-xs text-red-500">{err}</p>}

      <button type="submit" disabled={saving}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2">
        {saving ? (
          <><div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Guardando…</>
        ) : (
          <><Save className="h-4 w-4" /> Guardar consulta</>
        )}
      </button>
    </form>
  )
}

// ─────────────────── Consultation Card ───────────────────
function ConsultationCard({ c, index }: { c: Consultation; index: number }) {
  const [open, setOpen] = useState(index === 0)
  const bmi = c.weight && c.height ? (c.weight / ((c.height / 100) ** 2)).toFixed(1) : null

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600 shrink-0">
          #{c.consultationNumber}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{fmtDate(c.date)}</p>
          <div className="flex flex-wrap gap-2 mt-0.5">
            {c.weight && <span className="text-xs text-gray-500">{c.weight} kg</span>}
            {c.bodyFat && <span className="text-xs text-gray-500">• {c.bodyFat}% grasa</span>}
            {bmi && <span className="text-xs text-gray-400">• IMC {bmi}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {c.isPaid ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="h-3 w-3" /> Pagada
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <CreditCard className="h-3 w-3" /> Pendiente
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-50 px-5 pb-5 pt-4 space-y-4">
          {/* Measurements grid */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Medidas corporales</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                ["Peso", c.weight, "kg"],
                ["Talla", c.height, "cm"],
                ["% Grasa", c.bodyFat, "%"],
                ["Músculo", c.muscleMass, "kg"],
                ["Visceral", c.visceralFat, ""],
                ["Cintura", c.waist, "cm"],
                ["Cadera", c.hips, "cm"],
                ["Brazo", c.arms, "cm"],
              ].map(([label, val, unit]) => val ? (
                <div key={label as string} className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-base font-bold text-gray-800 tabular-nums">{val as number}{unit}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{label as string}</p>
                </div>
              ) : null)}
            </div>
          </div>

          {/* Macro targets */}
          {(c.calTarget || c.proteinTarget) && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Metas nutricionales</p>
              <div className="flex flex-wrap gap-2">
                {c.calTarget && <span className="flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-full"><Flame className="h-3 w-3" />{c.calTarget} kcal</span>}
                {c.proteinTarget && <span className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full"><Beef className="h-3 w-3" />{c.proteinTarget}g prot</span>}
                {c.carbsTarget && <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full"><Wheat className="h-3 w-3" />{c.carbsTarget}g carbs</span>}
                {c.fatTarget && <span className="flex items-center gap-1 text-xs font-semibold text-pink-700 bg-pink-50 px-2.5 py-1 rounded-full"><Salad className="h-3 w-3" />{c.fatTarget}g grasa</span>}
                {c.waterTarget && <span className="flex items-center gap-1 text-xs font-semibold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full"><Droplets className="h-3 w-3" />{c.waterTarget}ml agua</span>}
              </div>
            </div>
          )}

          {/* Notes */}
          {[["Observaciones", c.observations], ["Recomendaciones", c.recommendations], ["Suplementos", c.supplements]].map(([label, val]) => val ? (
            <div key={label as string}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label as string}</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{val as string}</p>
            </div>
          ) : null)}

          {c.nextAppointment && (
            <p className="text-xs text-violet-600 bg-violet-50 px-3 py-1.5 rounded-xl inline-block">
              <CalendarDays className="h-3.5 w-3.5 inline mr-1" />
              Próxima cita: {fmtDate(c.nextAppointment)}
            </p>
          )}
          {c.paymentAmount && (
            <p className="text-xs text-emerald-600">Pago: S/ {c.paymentAmount}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────── Progress Charts ───────────────────
function ProgressCharts({
  consultations, physicalRecords,
}: {
  consultations: Consultation[]
  physicalRecords: PhysicalRecord[]
}) {
  // Merge data from consultations and physicalRecords, sorted by date
  type DataPoint = { date: string; weight?: number; bodyFat?: number; waist?: number }

  const points: DataPoint[] = []
  const seen = new Set<string>()

  consultations.forEach((c) => {
    const d = c.date.split("T")[0]
    if (!seen.has(d)) {
      seen.add(d)
      points.push({ date: d, weight: c.weight ?? undefined, bodyFat: c.bodyFat ?? undefined, waist: c.waist ?? undefined })
    }
  })
  physicalRecords.forEach((r) => {
    const d = r.date.split("T")[0]
    if (!seen.has(d)) {
      seen.add(d)
      points.push({ date: d, weight: r.weight ?? undefined, bodyFat: r.bodyFat ?? undefined, waist: r.waist ?? undefined })
    }
  })
  points.sort((a, b) => a.date.localeCompare(b.date))

  if (points.length < 2) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
        <Scale className="h-10 w-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Necesitas al menos 2 registros para ver el progreso</p>
      </div>
    )
  }

  const first = points[0], last = points[points.length - 1]
  const weightChange = (first.weight && last.weight) ? (last.weight - first.weight).toFixed(1) : null
  const fatChange = (first.bodyFat && last.bodyFat) ? (last.bodyFat - first.bodyFat).toFixed(1) : null

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {last.weight && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-gray-900 tabular-nums">{last.weight} <span className="text-sm font-medium text-gray-400">kg</span></p>
            <p className="text-xs text-gray-400 mt-0.5">Peso actual</p>
            {weightChange && (
              <p className={cn("text-xs font-semibold mt-1", Number(weightChange) < 0 ? "text-emerald-600" : "text-red-500")}>
                {Number(weightChange) > 0 ? "+" : ""}{weightChange} kg total
              </p>
            )}
          </div>
        )}
        {last.bodyFat && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-gray-900 tabular-nums">{last.bodyFat} <span className="text-sm font-medium text-gray-400">%</span></p>
            <p className="text-xs text-gray-400 mt-0.5">% Grasa corporal</p>
            {fatChange && (
              <p className={cn("text-xs font-semibold mt-1", Number(fatChange) < 0 ? "text-emerald-600" : "text-red-500")}>
                {Number(fatChange) > 0 ? "+" : ""}{fatChange}% total
              </p>
            )}
          </div>
        )}
        {last.waist && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-gray-900 tabular-nums">{last.waist} <span className="text-sm font-medium text-gray-400">cm</span></p>
            <p className="text-xs text-gray-400 mt-0.5">Cintura</p>
          </div>
        )}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-gray-900 tabular-nums">{points.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Registros</p>
        </div>
      </div>

      {/* Weight chart */}
      {points.some((p) => p.weight) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-800 mb-4">Evolución del peso (kg)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={points} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} domain={["auto", "auto"]} />
              <Tooltip
                labelFormatter={(v) => fmtShort(v as string)}
                formatter={(v) => [`${v} kg`, "Peso"]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <Line type="monotone" dataKey="weight" stroke="#f97316" strokeWidth={2} dot={{ fill: "#f97316", r: 3 }} name="Peso" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Body fat chart */}
      {points.some((p) => p.bodyFat) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-800 mb-4">Evolución de % grasa corporal</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={points} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} domain={["auto", "auto"]} />
              <Tooltip
                labelFormatter={(v) => fmtShort(v as string)}
                formatter={(v) => [`${v}%`, "% Grasa"]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <Line type="monotone" dataKey="bodyFat" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6", r: 3 }} name="% Grasa" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Waist chart */}
      {points.some((p) => p.waist) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-800 mb-4">Evolución de cintura (cm)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={points} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} domain={["auto", "auto"]} />
              <Tooltip
                labelFormatter={(v) => fmtShort(v as string)}
                formatter={(v) => [`${v} cm`, "Cintura"]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <Line type="monotone" dataKey="waist" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 3 }} name="Cintura" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─────────────────── Diary Tab ───────────────────
function DiaryTab({ mealLogs, waterLogs, calTarget, proteinTarget, carbsTarget, fatTarget, waterTargetMl }: {
  mealLogs: MealLog[]
  waterLogs: WaterLog[]
  calTarget: number | null; proteinTarget: number | null; carbsTarget: number | null; fatTarget: number | null; waterTargetMl: number
}) {
  // Group by date
  const byDate: Record<string, MealLog[]> = {}
  mealLogs.forEach((l) => {
    if (!byDate[l.date]) byDate[l.date] = []
    byDate[l.date].push(l)
  })
  const dates = Object.keys(byDate).sort().reverse()

  if (dates.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
        <UtensilsCrossed className="h-12 w-12 text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400">El cliente no ha registrado comidas esta semana</p>
        <p className="text-xs text-gray-300 mt-1">Los registros aparecen aquí cuando el cliente marca sus comidas desde la app</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {dates.map((date) => {
        const logs = byDate[date]
        const totals = logs.reduce((a, l) => ({
          kcal: a.kcal + (l.status === "DONE" ? l.kcal : 0),
          protein: a.protein + (l.status === "DONE" ? l.protein : 0),
          carbs: a.carbs + (l.status === "DONE" ? l.carbs : 0),
          fat: a.fat + (l.status === "DONE" ? l.fat : 0),
        }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
        const waterMl = waterLogs.filter((w) => w.date === date).reduce((s, w) => s + w.ml, 0)
        const kcalPct = calTarget ? Math.min(100, (totals.kcal / calTarget) * 100) : null

        return (
          <div key={date} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Date header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
              <p className="text-sm font-bold text-gray-900">{fmtDate(date + "T12:00:00")}</p>
              <div className="flex items-center gap-3">
                {waterMl > 0 && (
                  <span className="flex items-center gap-1 text-xs text-sky-600">
                    <Droplets className="h-3.5 w-3.5" /> {waterMl >= 1000 ? `${(waterMl / 1000).toFixed(1)}L` : `${waterMl}ml`}
                  </span>
                )}
                <span className="text-xs font-semibold text-orange-600">{Math.round(totals.kcal)} kcal</span>
              </div>
            </div>

            {/* Progress bar */}
            {kcalPct !== null && (
              <div className="px-5 pt-3">
                <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                  <span>Calorías consumidas</span>
                  <span>{Math.round(totals.kcal)} / {calTarget} kcal ({Math.round(kcalPct)}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", kcalPct > 110 ? "bg-red-400" : kcalPct > 90 ? "bg-emerald-400" : "bg-orange-400")}
                    style={{ width: `${kcalPct}%` }} />
                </div>
                {/* Macro bars */}
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    ["Prot", totals.protein, proteinTarget, "bg-blue-400"],
                    ["Carbs", totals.carbs, carbsTarget, "bg-amber-400"],
                    ["Grasa", totals.fat, fatTarget, "bg-pink-400"],
                  ].map(([label, val, target, color]) => (
                    <div key={label as string}>
                      <div className="flex justify-between text-[9px] text-gray-400 mb-0.5">
                        <span>{label as string}</span>
                        <span>{Math.round(val as number)}g{target ? ` / ${target}g` : ""}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", color as string)}
                          style={{ width: target ? `${Math.min(100, ((val as number) / (target as number)) * 100)}%` : "0%" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meal items */}
            <div className="divide-y divide-gray-50 mt-2">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center gap-3 px-5 py-2.5">
                  {l.status === "DONE"
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    : <XCircle className="h-4 w-4 text-gray-300 shrink-0" />}
                  <p className={cn("flex-1 text-sm", l.status === "DONE" ? "text-gray-800" : "text-gray-400 line-through")}>{l.name}</p>
                  {l.status === "DONE" && l.kcal > 0 && (
                    <span className="text-xs text-gray-400 tabular-nums shrink-0">{Math.round(l.kcal)} kcal</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────── Profile Tab ───────────────────
function ProfileTab({ profile, clientId }: { profile: NutritionProfile; clientId: string }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...profile, birthDate: profile.birthDate?.split("T")[0] ?? "" })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true)
    await fetch(`/api/nutrition/clients/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setEditing(false)
  }

  const ACTIVITY_LEVELS = [
    { value: "SEDENTARY", label: "Sedentario" },
    { value: "LIGHT", label: "Ligero (1-2 días/sem)" },
    { value: "MODERATE", label: "Moderado (3-4 días/sem)" },
    { value: "ACTIVE", label: "Activo (5+ días/sem)" },
    { value: "VERY_ACTIVE", label: "Muy activo (atleta)" },
  ]

  const Field = ({ label, k, type = "text", options }: { label: string; k: keyof typeof form; type?: string; options?: { value: string; label: string }[] }) => (
    <div>
      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
      {editing ? (
        options ? (
          <select value={form[k] as string ?? ""} onChange={(e) => set(k as string, e.target.value)}
            className="mt-1 block w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 bg-white">
            <option value="">—</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : type === "textarea" ? (
          <textarea rows={3} value={form[k] as string ?? ""} onChange={(e) => set(k as string, e.target.value)}
            className="mt-1 block w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 resize-none" />
        ) : (
          <input type={type} value={form[k] as string ?? ""} onChange={(e) => set(k as string, e.target.value)}
            className="mt-1 block w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300" />
        )
      ) : (
        <p className="mt-0.5 text-sm text-gray-700">{(form[k] as string) || <span className="text-gray-300 italic">No registrado</span>}</p>
      )}
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Ficha clínica</h3>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors">
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1 text-xs text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg transition-colors">
              {saving ? <div className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 px-3 py-1.5 rounded-lg border border-orange-200 transition-colors">
            <Edit2 className="h-3.5 w-3.5" /> Editar
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Sexo" k="gender" options={[{ value: "M", label: "Masculino" }, { value: "F", label: "Femenino" }, { value: "OTHER", label: "Otro" }]} />
        <Field label="Fecha de nacimiento" k="birthDate" type="date" />
        <Field label="Teléfono" k="phone" type="tel" />
        <Field label="Email" k="email" type="email" />
        <Field label="Ocupación" k="occupation" />
        <Field label="Nivel de actividad física" k="physicalActivityLevel" options={ACTIVITY_LEVELS} />
      </div>

      <div className="space-y-4">
        <Field label="Objetivo actual" k="currentGoal" type="textarea" />
        <Field label="Condiciones médicas" k="medicalConditions" type="textarea" />
        <Field label="Alergias e intolerancias" k="allergies" type="textarea" />
        <Field label="Preferencias alimenticias" k="foodPreferences" type="textarea" />
        <Field label="Referido por" k="referredBy" />
        <Field label="Notas del nutricionista" k="notes" type="textarea" />
      </div>

      <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Estado: <span className={cn("font-semibold", profile.isActive ? "text-emerald-600" : "text-amber-600")}>{profile.isActive ? "Activo" : "Pausado"}</span>
        </span>
        <Link href={`/coaching/clients/${clientId}`} className="text-xs text-orange-500 hover:text-orange-600">
          Ver ficha de coaching →
        </Link>
      </div>
    </div>
  )
}

// ─────────────────── Main Component ───────────────────
export default function NutritionClientTabs({
  client, nutritionProfile, consultations: initialConsultations, messages, bookings, mealPlans, mealLogs, physicalRecords, waterLogs, initialTab,
}: {
  client: ClientData
  nutritionProfile: NutritionProfile
  consultations: Consultation[]
  messages: ChatMessage[]
  bookings: Booking[]
  mealPlans: MealPlan[]
  mealLogs: MealLog[]
  physicalRecords: PhysicalRecord[]
  waterLogs: WaterLog[]
  initialTab: string
}) {
  const [tab, setTab] = useState(initialTab)
  const [consultations, setConsultations] = useState(initialConsultations)
  const [showForm, setShowForm] = useState(false)

  const initials = `${client.firstName[0] ?? ""}${client.lastName?.[0] ?? ""}`.toUpperCase()
  const lastConsultation = consultations[0] ?? null

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/nutrition/clients" className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className={cn("h-11 w-11 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-bold text-white shadow-sm shrink-0", avatarColor(client.firstName))}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{client.firstName} {client.lastName}</h1>
          {client.goal && <p className="text-xs text-gray-400 truncate">{client.goal}</p>}
        </div>
        {/* Current macro targets */}
        <div className="hidden sm:flex flex-wrap gap-1.5 justify-end">
          <MacroPill label="Kcal" value={lastConsultation?.calTarget ?? client.calTarget} unit="" color="text-orange-700 bg-orange-50" />
          <MacroPill label="P" value={lastConsultation?.proteinTarget ?? client.proteinTarget} unit="g" color="text-blue-700 bg-blue-50" />
          <MacroPill label="C" value={lastConsultation?.carbsTarget ?? client.carbsTarget} unit="g" color="text-amber-700 bg-amber-50" />
          <MacroPill label="G" value={lastConsultation?.fatTarget ?? client.fatTarget} unit="g" color="text-pink-700 bg-pink-50" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 overflow-x-auto border-b border-gray-200 -mx-4 px-4 scrollbar-hide">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0",
              tab === key ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Plan ── */}
      {tab === "plan" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{mealPlans.length} plan(es) creados</p>
            <Link href={`/nutrition/new?clientId=${client.id}`} className="flex items-center gap-1.5 text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition-colors">
              <Plus className="h-4 w-4" /> Nuevo plan
            </Link>
          </div>
          {mealPlans.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <ChefHat className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Aún no hay planes nutricionales para este cliente</p>
              <Link href={`/nutrition/new?clientId=${client.id}`} className="mt-3 inline-block text-sm font-medium text-orange-500 hover:text-orange-600">
                Crear primer plan →
              </Link>
            </div>
          )}
          <div className="space-y-2">
            {mealPlans.map((p) => (
              <Link key={p.id} href={`/coaching/nutrition/${p.id}`} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:bg-orange-50 hover:border-orange-200 transition-all group">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", p.isActive ? "bg-emerald-100" : "bg-gray-100")}>
                  <ChefHat className={cn("h-5 w-5", p.isActive ? "text-emerald-600" : "text-gray-300")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-orange-600 transition-colors">{p.name}</p>
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {p.calTarget && <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">{p.calTarget} kcal</span>}
                    {p.proteinTarget && <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{p.proteinTarget}g P</span>}
                    {p.carbsTarget && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{p.carbsTarget}g C</span>}
                    {p.fatTarget && <span className="text-[10px] text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded-full">{p.fatTarget}g G</span>}
                  </div>
                </div>
                {p.isActive && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-semibold shrink-0">Activo</span>}
                <span className="text-xs text-gray-300 shrink-0 hidden sm:block">{fmtDate(p.createdAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Consultations ── */}
      {tab === "consultations" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{consultations.length} consulta(s)</p>
            <button onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-1.5 text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition-colors">
              {showForm ? <><X className="h-4 w-4" /> Cancelar</> : <><Plus className="h-4 w-4" /> Nueva consulta</>}
            </button>
          </div>

          {showForm && (
            <ConsultationForm
              nutritionClientId={nutritionProfile.id}
              onSaved={(c) => {
                setConsultations((prev) => [c, ...prev])
                setShowForm(false)
              }}
            />
          )}

          {consultations.length === 0 && !showForm && (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <Stethoscope className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Aún no hay consultas registradas</p>
              <button onClick={() => setShowForm(true)} className="mt-3 text-sm font-medium text-orange-500 hover:text-orange-600">
                Registrar primera consulta →
              </button>
            </div>
          )}

          <div className="space-y-2">
            {consultations.map((c, i) => (
              <ConsultationCard key={c.id} c={c} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── Progress ── */}
      {tab === "progress" && (
        <ProgressCharts consultations={consultations} physicalRecords={physicalRecords} />
      )}

      {/* ── Diary ── */}
      {tab === "diary" && (
        <DiaryTab
          mealLogs={mealLogs}
          waterLogs={waterLogs}
          calTarget={lastConsultation?.calTarget ?? client.calTarget}
          proteinTarget={lastConsultation?.proteinTarget ?? client.proteinTarget}
          carbsTarget={lastConsultation?.carbsTarget ?? client.carbsTarget}
          fatTarget={lastConsultation?.fatTarget ?? client.fatTarget}
          waterTargetMl={client.waterTargetMl}
        />
      )}

      {/* ── Clinical Profile ── */}
      {tab === "profile" && (
        <ProfileTab profile={nutritionProfile} clientId={client.id} />
      )}

      {/* ── Agenda ── */}
      {tab === "agenda" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{bookings.filter((b) => new Date(b.startsAt) >= new Date()).length} cita(s) próximas</p>
            <Link href="/nutrition/agenda" className="text-sm text-orange-500 hover:text-orange-600 font-medium">
              Gestionar agenda →
            </Link>
          </div>
          {bookings.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <CalendarDays className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Sin citas agendadas</p>
              <Link href="/nutrition/agenda" className="mt-3 inline-block text-sm font-medium text-orange-500 hover:text-orange-600">
                Crear cita en la agenda →
              </Link>
            </div>
          )}
          <div className="space-y-2">
            {bookings.map((b) => {
              const past = new Date(b.startsAt) < new Date()
              return (
                <div key={b.id} className={cn("flex items-center gap-3 border rounded-xl px-4 py-3", past ? "bg-gray-50 border-gray-100" : "bg-white border-gray-200")}>
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", past ? "bg-gray-100" : "bg-violet-100")}>
                    <CalendarDays className={cn("h-5 w-5", past ? "text-gray-300" : "text-violet-600")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", past ? "text-gray-400" : "text-gray-900")}>{b.title}</p>
                    <p className="text-xs text-gray-400">{fmtDate(b.startsAt)}</p>
                  </div>
                  {past && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Pasada</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Chat ── */}
      {tab === "chat" && (
        <div className="h-[calc(100vh-13rem)] flex flex-col border border-gray-200 rounded-xl overflow-hidden">
          <ChatPanel
            mode="nutritionist"
            clientId={client.id}
            initialMessages={messages}
            channel="NUTRITION"
            className="flex-1 min-h-0"
          />
        </div>
      )}
    </div>
  )
}
