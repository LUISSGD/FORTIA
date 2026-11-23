import Link from "next/link"
import { cn } from "@/lib/utils"
import { formatYmdLong } from "@/lib/coaching/dates"
import { trainerStyle } from "@/lib/trainers"
import PushToggle from "@/components/coaching/PushToggle"
import type { Digest } from "@/lib/coaching/digest"

// Pantalla "Hoy" del administrador: todo lo que hay que atender, con enlace a donde se resuelve.

const soles = (n: number) => `S/ ${n.toLocaleString("es-PE", { maximumFractionDigits: 2 })}`
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"]
const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`
const STATE: Record<string, string> = { given: "✅", noShow: "❌", unmarked: "⚠️", upcoming: "" }

function due(days: number | null) {
  if (days === null) return ""
  if (days === 0) return "hoy"
  if (days === 1) return "mañana"
  return days > 0 ? `en ${days} días` : days === -1 ? "venció ayer" : `venció hace ${-days} días`
}

function Block({ title, count, href, cta, tone, children, empty }: { title: string; count: number; href: string; cta: string; tone: string; children?: React.ReactNode; empty: string }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-gray-900">{title} {count > 0 && <span className={cn("ml-1 rounded-full px-2 py-0.5 text-xs", tone)}>{count}</span>}</h2>
        <Link href={href} className="shrink-0 text-xs font-medium text-orange-600 hover:underline">{cta} →</Link>
      </div>
      {count > 0 ? <ul className="mt-2 space-y-1.5">{children}</ul> : <p className="mt-1 text-xs text-gray-400">{empty}</p>}
    </section>
  )
}

const row = "flex items-baseline justify-between gap-3 text-sm"
const left = "min-w-0 truncate text-gray-800"
const right = "shrink-0 text-xs text-gray-500"
const more = (total: number, shown: number) => total > shown && <li className="text-xs text-gray-400">y {total - shown} más</li>

export default function TodayDigest({ d }: { d: Digest }) {
  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Hoy</p>
          <h1 className="text-xl font-bold text-gray-900">{formatYmdLong(d.today)}</h1>
        </div>
        <PushToggle variant="button" />
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <Block title="💰 Por cobrar" count={d.collect.count} href="/finances/cobranza" cta="Cobranza" tone="bg-emerald-100 text-emerald-800" empty="No hay cobros pendientes hoy.">
          <li className="text-sm font-semibold text-emerald-700">{soles(d.collect.total)}{d.collect.promises > 0 && <span className="ml-2 font-normal text-violet-700">{d.collect.promises} prometió pagar hoy</span>}</li>
          {d.collect.top.map((c, k) => <li key={k} className={row}><span className={left}>{c.name}</span><span className={right}>{soles(c.amount)} · {due(c.daysLeft) || "sin fecha"}</span></li>)}
          {more(d.collect.count, d.collect.top.length)}
        </Block>

        <Block title="🏋️ Clases de hoy" count={d.classes.today.length} href="/coaching/agenda" cta="Agenda" tone="bg-gray-100 text-gray-700" empty="Hoy no hay clases agendadas.">
          {d.classes.today.map((c) => (
            <li key={`${c.kind}-${c.id}`} className={row}>
              <span className={left}><b className="tabular-nums">{c.time ?? "--:--"}</b> {c.client} {c.kind === "trial" && <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">PRUEBA</span>}</span>
              <span className={cn("shrink-0 text-xs font-medium", trainerStyle(c.trainer).text)}>{STATE[c.state]} {c.trainer}</span>
            </li>
          ))}
        </Block>

        <Block title="⚠️ Clases sin marcar (7 días)" count={d.classes.unmarked.length} href="/coaching/agenda/clases" cta="Marcarlas" tone="bg-amber-100 text-amber-800" empty="Todas las clases están marcadas.">
          {d.classes.unmarked.slice(0, 6).map((c) => <li key={`${c.kind}-${c.id}`} className={row}><span className={left}>{c.client}</span><span className={right}>{dm(c.date)} · {c.trainer}</span></li>)}
          {more(d.classes.unmarked.length, 6)}
        </Block>

        <Block title="🎯 Interesados por atender" count={d.leads.length} href="/coaching/interesados" cta="Interesados" tone="bg-sky-100 text-sky-800" empty="Nadie espera respuesta.">
          {d.leads.slice(0, 6).map((l) => <li key={l.id} className={row}><span className={left}>{[l.firstName, l.lastName].filter(Boolean).join(" ")}</span><span className="shrink-0 text-xs text-red-600">{l.alert}</span></li>)}
          {more(d.leads.length, 6)}
        </Block>

        <Block title="🚨 Alumnos en riesgo" count={d.risk.length} href="/coaching/clients" cta="Clientes" tone="bg-red-100 text-red-700" empty="Sin señales de riesgo.">
          {d.risk.slice(0, 8).map((r) => <li key={r.id} className={row}><Link href={`/coaching/clients/${r.id}`} className={cn(left, "hover:text-orange-600")}>{r.name}</Link><span className={right}>{r.reason}</span></li>)}
          {more(d.risk.length, 8)}
        </Block>

        <Block title="🧾 Pagos del plan por vencer" count={d.obligations.length} href="/finances/plan" cta="Plan del mes" tone="bg-orange-100 text-orange-800" empty="Nada por pagar en los próximos 3 días.">
          {d.obligations.slice(0, 8).map((o) => (
            <li key={o.id} className={row}>
              <span className={left}>{o.concept} <span className="text-xs text-gray-400">{MONTHS[o.month - 1]}</span></span>
              <span className={cn("shrink-0 text-xs", o.daysLeft < 0 ? "text-red-600" : "text-gray-500")}>{o.currency === "USD" ? `US$ ${o.amount.toLocaleString("es-PE")}` : soles(o.amount)} · {due(o.daysLeft)}</span>
            </li>
          ))}
          {more(d.obligations.length, 8)}
        </Block>

        <Block title="📋 Rutinas por renovar" count={d.programs.length} href="/coaching/vencimientos?ver=programas" cta="Ver todas" tone="bg-violet-100 text-violet-800" empty="Ninguna rutina termina esta semana.">
          {d.programs.slice(0, 8).map((p) => <li key={p.id} className={row}><Link href={`/coaching/clients/${p.id}?tab=training`} className={cn(left, "hover:text-orange-600")}>{p.name}</Link><span className={right}>{p.label}</span></li>)}
          {more(d.programs.length, 8)}
        </Block>
      </div>
    </div>
  )
}
