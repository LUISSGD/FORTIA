import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { getClientsOverview, type ClientOverview } from "@/lib/coaching/stats"
import { formatYmdLong } from "@/lib/coaching/dates"
import { cn } from "@/lib/utils"
import { programEndLabel } from "@/lib/coaching/program-dates"

// Vencimientos ordenados por fecha, pensado para el celular: membresías (pago) o
// programas de entrenamiento (duración que define el coach).

type Group = { key: string; title: string; tone: string; rows: ClientOverview[] }
export type ExpiryKind = "memberships" | "programs"

/** Fecha que se ordena en cada vista: fin de membresía o fin del programa activo. */
function expiry(c: ClientOverview, kind: ExpiryKind): { daysLeft: number | null; end: string | null; label: string } {
  if (kind === "programs") return { daysLeft: c.program?.daysLeft ?? null, end: c.program?.end ?? null, label: c.program?.name ?? "Sin programa asignado" }
  return { daysLeft: c.membership.daysLeft, end: c.membership.end, label: c.membership.planName ?? "Sin plan" }
}

const waLink = (c: ClientOverview, text: string) =>
  `https://wa.me/${c.phone!.replace(/\D/g, "").replace(/^(?!51)/, "51")}?text=${encodeURIComponent(text)}`

function whenLabel(days: number) {
  if (days === 0) return "Vence hoy"
  if (days === 1) return "Vence mañana"
  if (days > 0) return `En ${days} días`
  if (days === -1) return "Venció ayer"
  return `Venció hace ${-days} días`
}

/** basePath: "/coaching" (admin, con saldos) o "/trainer" (entrenador, sin montos). */
export default async function ExpiryList({ basePath, showStandby, kind = "memberships" }: { basePath: "/coaching" | "/trainer"; showStandby: boolean; kind?: ExpiryKind }) {
  const isAdmin = basePath === "/coaching"
  const programs = kind === "programs"
  const self = `${basePath}/vencimientos`
  const query = (k: ExpiryKind, standby: boolean) => {
    const qs = [k === "programs" && "ver=programas", standby && "standby=1"].filter(Boolean).join("&")
    return qs ? `${self}?${qs}` : self
  }
  const all = await getClientsOverview()
  const clients = all.filter((c) => (showStandby ? true : c.status !== "STANDBY"))

  const days = (c: ClientOverview) => expiry(c, kind).daysLeft
  const dated = clients.filter((c) => days(c) !== null)
  const byDate = (a: ClientOverview, b: ClientOverview) => days(a)! - days(b)!
  const groups: Group[] = [
    { key: "expired", title: programs ? "Terminados" : "Vencidos", tone: "text-red-600", rows: dated.filter((c) => days(c)! < 0).sort((a, b) => byDate(b, a)) },
    { key: "week", title: programs ? "Terminan en los próximos 7 días" : "Vencen en los próximos 7 días", tone: "text-orange-600", rows: dated.filter((c) => days(c)! >= 0 && days(c)! <= 7).sort(byDate) },
    { key: "month", title: programs ? "Terminan en 8 a 30 días" : "Vencen en 8 a 30 días", tone: "text-amber-600", rows: dated.filter((c) => days(c)! > 7 && days(c)! <= 30).sort(byDate) },
    { key: "later", title: "Más de 30 días", tone: "text-emerald-600", rows: dated.filter((c) => days(c)! > 30).sort(byDate) },
    { key: "none", title: programs ? "Sin programa o sin fecha" : "Sin fecha de vencimiento", tone: "text-gray-500", rows: clients.filter((c) => days(c) === null) },
  ]
  const balances = !isAdmin || programs ? [] : clients
    .filter((c) => c.pendingBalance)
    .sort((a, b) => (a.pendingBalance!.dueDate ?? "9999").localeCompare(b.pendingBalance!.dueDate ?? "9999"))

  return (
    <div className={cn("max-w-2xl mx-auto space-y-4", isAdmin ? "pb-20" : "p-4")}>
      <div>
        <h1 className="text-xl font-bold">Vencimientos</h1>
        <p className="text-sm text-gray-500">
          {groups[0].rows.length} {programs ? "terminados" : "vencidos"} · {groups[1].rows.length} esta semana · {groups[2].rows.length} este mes
        </p>
      </div>

      <div className="grid grid-cols-2 rounded-lg bg-gray-100 p-1 text-sm">
        {([["memberships", "Membresías"], ["programs", "Programas"]] as const).map(([k, label]) => (
          <Link key={k} href={query(k, showStandby)} className={cn("rounded-md py-1.5 text-center", kind === k ? "bg-white font-semibold text-gray-900 shadow-sm" : "text-gray-500")}>
            {label}
          </Link>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {groups.filter((g) => g.rows.length).map((g) => (
          <a key={g.key} href={`#${g.key}`} className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700">
            {g.title.replace(/^(Vencen|Terminan) en (los próximos )?/, "")} <b>{g.rows.length}</b>
          </a>
        ))}
        <Link
          href={query(kind, !showStandby)}
          className={cn("shrink-0 rounded-full border px-3 py-1 text-xs", showStandby ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-500")}
        >
          {showStandby ? "✓ Con stand-by" : "+ Incluir stand-by"}
        </Link>
      </div>

      {balances.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-red-600">Saldos por cobrar · {balances.length}</h2>
          <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {balances.map((c) => {
              const b = c.pendingBalance!
              return (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Link href={`/coaching/clients/${c.id}?tab=payments`} className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{c.name}</p>
                    <p className={cn("text-xs", b.overdueDays > 0 ? "text-red-600" : "text-amber-700")}>
                      S/ {b.amount.toLocaleString("es-PE")}{b.dueDate ? ` · ${b.overdueDays > 0 ? "venció" : "vence"} ${formatYmdLong(b.dueDate)}` : ""}
                    </p>
                  </Link>
                  {c.phone && (
                    <a href={waLink(c, `¡Hola ${c.firstName}! Te escribo para recordarte el saldo pendiente de S/ ${b.amount} de tu plan en FORTIA 💪`)} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
                      WhatsApp
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {groups.filter((g) => g.rows.length).map((g) => (
        <section key={g.key} id={g.key} className="space-y-2 scroll-mt-20">
          <h2 className={cn("text-sm font-bold", g.tone)}>{g.title} · {g.rows.length}</h2>
          <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {g.rows.map((c) => {
              const m = expiry(c, kind)
              const days = m.daysLeft
              const href = programs
                ? `${basePath}/clients/${c.id}?tab=training`
                : isAdmin ? `/coaching/clients/${c.id}?tab=membership` : `/trainer/clients/${c.id}?tab=ep`
              return (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Link href={href} className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">
                      {c.name}
                      {c.status === "STANDBY" && <span className="ml-1.5 text-[10px] font-normal text-gray-400">stand-by</span>}
                      {c.status === "PAUSED" && <span className="ml-1.5 text-[10px] font-normal text-gray-400">pausado</span>}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{m.label}</p>
                    {m.end && days !== null && (
                      <p className={cn("text-xs font-medium", g.tone)}>
                        {formatYmdLong(m.end)} · {programs ? programEndLabel(days) : whenLabel(days)}
                      </p>
                    )}
                  </Link>
                  {!programs && c.phone && days !== null && days <= 30 && (
                    <a
                      href={waLink(c, days < 0
                        ? `¡Hola ${c.firstName}! Tu plan en FORTIA venció el ${formatYmdLong(m.end!).toLowerCase()}. ¿Te ayudo a renovarlo? 💪`
                        : `¡Hola ${c.firstName}! Te recuerdo que tu plan en FORTIA vence el ${formatYmdLong(m.end!).toLowerCase()}. ¿Coordinamos la renovación? 💪`)}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700"
                    >
                      WhatsApp
                    </a>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
