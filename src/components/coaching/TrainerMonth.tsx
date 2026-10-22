import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getTrainerMonth, type ClassState, type MonthClass } from "@/lib/coaching/trainer-month"
import { trainerStyle } from "@/lib/trainers"
import TrainerMonthExport from "./TrainerMonthExport"

// Clases del mes por entrenador (comisiones). Se usa en el panel del entrenador y en el del admin.

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"]
const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const dayLabel = (ymd: string) => `${DAYS[new Date(`${ymd}T12:00:00Z`).getUTCDay()]} ${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`
const shift = (ym: string, d: number) => {
  const [y, m] = ym.split("-").map(Number)
  const t = new Date(Date.UTC(y, m - 1 + d, 1))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`
}

const SECTIONS: { state: ClassState; title: string; tone: string; hint?: string }[] = [
  { state: "unmarked", title: "Sin marcar", tone: "text-amber-700", hint: "Clases que ya pasaron y no se marcaron: márcalas para que cuenten." },
  { state: "given", title: "Clases dadas", tone: "text-emerald-700" },
  { state: "noShow", title: "No asistió", tone: "text-red-600" },
  { state: "upcoming", title: "Por dar este mes", tone: "text-gray-700" },
]

export default async function TrainerMonth({ basePath, month, trainer }: { basePath: "/trainer" | "/coaching"; month: string | undefined; trainer: string | undefined }) {
  const now = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7)
  const ym = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : now
  const data = await getTrainerMonth(ym)
  const self = basePath === "/trainer" ? "/trainer/clases" : "/coaching/agenda/clases"
  const href = (p: { month?: string; t?: string | null }) => {
    const q = new URLSearchParams()
    const m = p.month ?? ym
    if (m !== now) q.set("month", m)
    const t = p.t === undefined ? trainer : p.t
    if (t) q.set("t", t)
    const s = q.toString()
    return s ? `${self}?${s}` : self
  }
  const shown = data.classes.filter((c) => !trainer || c.trainer === trainer)
  const totals = data.totals.filter((t) => !trainer || t.trainer === trainer)
  const clientHref = (c: MonthClass) =>
    !c.clientId ? null : basePath === "/trainer" ? `/trainer/clients/${c.clientId}?tab=ep` : `/coaching/clients/${c.clientId}?tab=membership`
  const label = `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={href({ month: shift(ym, -1) })} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Clases del mes · {label}</h1>
            <p className="text-xs text-gray-500">Clases personalizadas y de prueba por entrenador. Base para las comisiones.</p>
          </div>
          <Link href={href({ month: shift(ym, 1) })} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></Link>
        </div>
        <TrainerMonthExport label={label} trainer={trainer ?? null} rows={shown} totals={totals} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={href({ t: null })} className={cn("rounded-full border px-3 py-1 text-xs", !trainer ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600")}>Todos</Link>
        {data.totals.map((t) => (
          <Link key={t.trainer} href={href({ t: t.trainer })} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", trainer === t.trainer ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600")}>
            <span className={cn("h-2 w-2 rounded-full", trainerStyle(t.trainer).dot)} />
            {t.trainer}
          </Link>
        ))}
      </div>

      <div className={cn("grid gap-3", totals.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : "")}>
        {totals.map((t) => {
          const st = trainerStyle(t.trainer)
          return (
            <div key={t.trainer} className={cn("rounded-xl border p-4 space-y-2", st.card)}>
              <p className={cn("text-sm font-bold", st.text)}>{t.trainer}</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-gray-900 tabular-nums">{t.given}</p>
                <p className="pb-1 text-sm text-gray-600">clases dadas</p>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-gray-600">
                <span>❌ No asistió: <b>{t.noShow}</b></span>
                <span>🗓️ Por dar: <b>{t.upcoming}</b></span>
                <span className={t.unmarked ? "text-amber-700 font-semibold" : ""}>⚠️ Sin marcar: <b>{t.unmarked}</b></span>
                <span>⭐ Pruebas dadas: <b>{t.trialsGiven}</b></span>
              </div>
              <p className="text-[11px] text-gray-500">Total del mes: {t.given + t.noShow + t.unmarked + t.upcoming} clases personalizadas</p>
            </div>
          )
        })}
        {!totals.length && <p className="text-sm text-gray-500">No hay clases en {label.toLowerCase()}.</p>}
      </div>

      {SECTIONS.map((sec) => {
        const rows = shown.filter((c) => c.state === sec.state)
        if (!rows.length) return null
        return (
          <section key={sec.state} className="rounded-xl border border-gray-200 bg-white">
            <div className="px-4 pt-3 pb-2">
              <h2 className={cn("text-sm font-bold", sec.tone)}>{sec.title} · {rows.length}</h2>
              {sec.hint && <p className="text-[11px] text-gray-500">{sec.hint}</p>}
            </div>
            <ul className="divide-y divide-gray-100">
              {rows.map((c) => {
                const link = clientHref(c)
                const st = trainerStyle(c.trainer)
                const body = (
                  <>
                    <span className="w-20 shrink-0 text-xs text-gray-500">{dayLabel(c.date)}<span className="block">{c.time ?? "sin hora"}</span></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900">{c.client}{c.kind === "trial" && <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">PRUEBA</span>}</span>
                      <span className="block truncate text-[11px] text-gray-500">{c.plan}{c.number ? ` · ${c.number}` : ""}</span>
                    </span>
                    {!trainer && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", st.pill)}>{c.trainer}</span>}
                  </>
                )
                return (
                  <li key={`${c.kind}-${c.id}`}>
                    {link ? <Link href={link} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50">{body}</Link> : <div className="flex items-center gap-3 px-4 py-2">{body}</div>}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      <p className="text-[11px] text-gray-400">
        Cada clase cuenta para el entrenador que estaba asignado al cliente cuando se marcó la asistencia. Las parejas cuentan como una clase.
      </p>
    </div>
  )
}
