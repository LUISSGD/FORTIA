import Link from "next/link"
import { cn } from "@/lib/utils"
import { formatYmdLong } from "@/lib/coaching/dates"
import { trainerStyle } from "@/lib/trainers"
import type { StaffToday as Data } from "@/lib/coaching/digest"

// Pantalla "Hoy" del staff: clases y rutinas, sin cobros ni datos del negocio.

const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`
const STATE: Record<string, string> = { given: "✅", noShow: "❌", unmarked: "⚠️", upcoming: "" }
const row = "flex items-baseline justify-between gap-3 text-sm"

function Block({ title, count, tone, empty, children }: { title: string; count: number; tone: string; empty: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-bold text-gray-900">{title} {count > 0 && <span className={cn("ml-1 rounded-full px-2 py-0.5 text-xs", tone)}>{count}</span>}</h2>
      {count > 0 ? <ul className="mt-2 space-y-2">{children}</ul> : <p className="mt-1 text-xs text-gray-400">{empty}</p>}
    </section>
  )
}

/** `linkClients`: si la cuenta tiene el acceso a Clientes, el nombre abre la ficha. */
export default function StaffToday({ d, linkClients }: { d: Data; linkClients: boolean }) {
  const person = (id: string | null, name: string) =>
    id && linkClients ? <Link href={`/clients/${id}`} className="underline decoration-gray-200 underline-offset-2 hover:text-orange-600">{name}</Link> : name
  const trial = <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">PRUEBA</span>

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-3 pb-24 md:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Hoy</p>
        <h1 className="text-xl font-bold text-gray-900">{formatYmdLong(d.today)}</h1>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <Block title="🏋️ Clases de hoy" count={d.classes.today.length} tone="bg-gray-100 text-gray-700" empty="Hoy no hay clases agendadas.">
          {d.classes.today.map((c) => (
            <li key={`${c.kind}-${c.id}`} className={row}>
              <span className="min-w-0 text-gray-800"><b className="tabular-nums">{c.time ?? "--:--"}</b> {person(c.clientId, c.client)} {c.kind === "trial" && trial}</span>
              <span className={cn("shrink-0 text-xs font-medium", trainerStyle(c.trainer).text)}>{STATE[c.state]} {c.trainer}</span>
            </li>
          ))}
        </Block>

        <Block title="⚠️ Clases sin marcar (7 días)" count={d.classes.unmarked.length} tone="bg-amber-100 text-amber-800" empty="Todas las clases están marcadas.">
          {d.classes.unmarked.map((c) => (
            <li key={`${c.kind}-${c.id}`} className={row}>
              <span className="min-w-0 text-gray-800">{person(c.clientId, c.client)} {c.kind === "trial" && trial}</span>
              <span className="shrink-0 text-xs text-gray-500">{dm(c.date)}{c.time ? ` ${c.time}` : ""} · <span className={trainerStyle(c.trainer).text}>{c.trainer}</span></span>
            </li>
          ))}
        </Block>

        <Block title="📋 Rutinas por renovar" count={d.programs.length} tone="bg-violet-100 text-violet-800" empty="Ninguna rutina termina esta semana.">
          {d.programs.map((p) => (
            <li key={p.id} className={row}>
              <span className="min-w-0 text-gray-800">{person(p.id, p.name)}</span>
              <span className="shrink-0 text-xs text-gray-500">{p.label}</span>
            </li>
          ))}
        </Block>
      </div>
    </main>
  )
}
