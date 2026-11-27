"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { trainerStyle } from "@/lib/trainers"
import type { PtRow, PtState } from "@/lib/coaching/pt-panel"

const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]
const day = (ymd: string) => `${DAYS[new Date(`${ymd}T12:00:00Z`).getUTCDay()]} ${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`
const soles = (n: number) => `S/ ${n.toLocaleString("es-PE", { maximumFractionDigits: 0 })}`

const STATE: Record<PtState, { label: string; cls: string }> = {
  ended: { label: "Terminó, sin renovar", cls: "bg-red-100 text-red-800" },
  renew: { label: "Por renovar", cls: "bg-amber-100 text-amber-800" },
  check: { label: "Revisar", cls: "bg-sky-100 text-sky-800" },
  paused: { label: "En pausa", cls: "bg-gray-100 text-gray-600" },
  renewed: { label: "Renovó", cls: "bg-emerald-100 text-emerald-800" },
  ok: { label: "Al día", cls: "bg-gray-100 text-gray-600" },
}
const VIEWS = [
  { key: "all", label: "Todos" },
  { key: "renew", label: "Por renovar" },
  { key: "ended", label: "Terminaron" },
  { key: "check", label: "Revisar" },
] as const
type View = (typeof VIEWS)[number]["key"]

/** Qué se hizo con la renovación (solo el administrador lo ve). */
function followUpText(r: PtRow): string | null {
  if (r.skipped) return "Marcado: no renueva"
  const f = r.followUp
  if (!f) return null
  if (f.outcome === "DISMISSED") return "Marcado: no renueva"
  if (f.outcome === "PROMISED" && f.promise) return `Prometió pagar el ${day(f.promise)}`
  return `Le escribiste el ${day(f.at)}`
}

function lastText(r: PtRow): string | null {
  if (!r.last || r.daysToLast === null) return null
  if (r.state === "ended") return r.daysToLast === 0 ? "Última clase: hoy" : `Última clase hace ${-r.daysToLast} días`
  if (r.daysToLast < 0) return `Su última clase agendada fue el ${day(r.last)}`
  return `Última clase: ${day(r.last)}`
}

export default function PtPanel({ rows, trainers, withMoney, initialTrainer }: { rows: PtRow[]; trainers: string[]; withMoney: boolean; initialTrainer: string | null }) {
  const [trainer, setTrainer] = useState<string | null>(initialTrainer && trainers.includes(initialTrainer) ? initialTrainer : null)
  const [view, setView] = useState<View>("all")

  const pick = (t: string | null) => {
    setTrainer(t)
    const url = new URL(window.location.href)
    if (t) url.searchParams.set("entrenador", t)
    else url.searchParams.delete("entrenador")
    window.history.replaceState(null, "", url)
  }

  const mine = useMemo(() => rows.filter((r) => !trainer || r.trainer === trainer), [rows, trainer])
  const shown = mine.filter((r) => view === "all" || r.state === view)
  const count = (list: PtRow[], s: PtState) => list.filter((r) => r.state === s).length
  const summary = (list: PtRow[]) => {
    const active = list.filter((r) => r.state !== "ended")
    return { students: active.length, classes: active.reduce((n, r) => n + r.remaining, 0), renew: count(list, "renew"), ended: count(list, "ended") }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Clases personalizadas</h1>
        <p className="text-sm text-gray-500">Cuántas clases le quedan a cada alumno y quién tiene que renovar. Una falta descuenta la clase igual que una asistencia. “Revisar” = tiene clases pasadas sin marcar o ninguna agendada.</p>
      </div>

      <div className={cn("grid gap-2", trainers.length > 2 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
        {[null, ...trainers].map((t) => {
          const s = summary(t ? rows.filter((r) => r.trainer === t) : rows)
          const active = trainer === t
          return (
            <button key={t ?? "all"} type="button" onClick={() => pick(t)} aria-pressed={active}
              className={cn("rounded-xl border bg-white p-3 text-left transition-colors", active ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200 hover:border-gray-400")}>
              <p className={cn("text-sm font-bold", t ? trainerStyle(t).text : "text-gray-900")}>{t ?? "Todos"}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{s.students} <span className="text-sm font-normal text-gray-500">alumnos</span></p>
              <p className="text-xs text-gray-500">{s.classes} clases por dar</p>
              <p className="mt-1 text-xs">
                {s.renew > 0 && <span className="font-semibold text-amber-700">{s.renew} por renovar</span>}
                {s.renew > 0 && s.ended > 0 && " · "}
                {s.ended > 0 && <span className="font-semibold text-red-700">{s.ended} sin renovar</span>}
                {s.renew + s.ended === 0 && <span className="text-gray-400">Nadie por renovar</span>}
              </p>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar por renovación">
        {VIEWS.map((v) => {
          const n = v.key === "all" ? mine.length : count(mine, v.key)
          return (
            <button key={v.key} type="button" role="tab" aria-selected={view === v.key} onClick={() => setView(v.key)}
              className={cn("rounded-full px-3 py-1.5 text-xs font-medium", view === v.key ? "bg-gray-900 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50")}>
              {v.label} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">No hay alumnos en esta vista.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {shown.map((r) => {
            const pct = r.total ? Math.round((r.used / r.total) * 100) : 0
            const st = STATE[r.state]
            const follow = withMoney && r.state !== "ok" && r.state !== "renewed" ? followUpText(r) : null
            const last = lastText(r)
            return (
              <li key={r.planId} className={cn("min-w-0 rounded-xl border bg-white p-3", r.state === "ended" ? "border-red-200" : r.state === "renew" ? "border-amber-200" : "border-gray-200")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/clients/${r.clientId}`} className="font-semibold text-gray-900 underline decoration-gray-200 underline-offset-2 hover:text-orange-600">{r.name}</Link>
                    <p className="truncate text-xs text-gray-500"><span className={trainerStyle(r.trainer).text}>{r.trainer}</span> · {r.plan}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", st.cls)}>{st.label}{r.state === "renewed" && r.renewedOn ? ` ${day(r.renewedOn).slice(4)}` : ""}</span>
                </div>

                {r.state !== "ended" && (
                  <div className="mt-2.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-bold tabular-nums text-gray-900">Quedan {r.remaining} <span className="font-normal text-gray-500">de {r.total}</span></span>
                      <span className="text-xs tabular-nums text-gray-500">{r.used} usadas</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className={cn("h-full rounded-full", r.state === "renew" ? "bg-amber-500" : "bg-gray-800")} style={{ width: `${pct}%` }} /></div>
                  </div>
                )}

                <div className="mt-2 space-y-0.5 text-xs text-gray-600">
                  {r.next && <p>Próxima clase: {day(r.next)}</p>}
                  {last && <p>{last}</p>}
                  {(r.noShows > 0 || r.unmarked > 0) && (
                    <p>
                      {r.noShows > 0 && <span>Faltó {r.noShows} {r.noShows === 1 ? "vez" : "veces"} (descontadas)</span>}
                      {r.noShows > 0 && r.unmarked > 0 && " · "}
                      {r.unmarked > 0 && <span className="font-medium text-amber-700">{r.unmarked} sin marcar</span>}
                    </p>
                  )}
                  {r.state !== "ended" && !r.next && r.remaining > 0 && <p className="font-medium text-sky-800">{r.unmarked > 0 ? "Marca la asistencia de las clases pasadas para saber cuántas le quedan" : "Le quedan clases pero no tiene ninguna agendada"}</p>}
                  {withMoney && (r.state === "renew" || r.state === "ended") && r.price ? <p>Renovación: <b className="text-gray-900">{soles(r.price)}</b></p> : null}
                  {follow && <p className="font-medium text-gray-900">{follow}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {withMoney && <p className="text-xs text-gray-400">Para escribirles, usa <Link href="/finances/cobranza" className="underline">Cobranza</Link>: ahí queda registrado a quién le escribiste.</p>}
    </div>
  )
}
