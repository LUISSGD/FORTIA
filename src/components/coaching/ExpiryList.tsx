import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { getClientsOverview, type ClientOverview } from "@/lib/coaching/stats"
import { formatYmdLong } from "@/lib/coaching/dates"
import { cn } from "@/lib/utils"

// Vencimientos de membresía ordenados por fecha, pensado para el celular.

type Group = { key: string; title: string; tone: string; rows: ClientOverview[] }

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
export default async function ExpiryList({ basePath, showStandby }: { basePath: "/coaching" | "/trainer"; showStandby: boolean }) {
  const isAdmin = basePath === "/coaching"
  const self = `${basePath}/vencimientos`
  const all = await getClientsOverview()
  const clients = all.filter((c) => (showStandby ? true : c.status !== "STANDBY"))

  const dated = clients.filter((c) => c.membership.daysLeft !== null)
  const byDate = (a: ClientOverview, b: ClientOverview) => a.membership.daysLeft! - b.membership.daysLeft!
  const groups: Group[] = [
    { key: "expired", title: "Vencidos", tone: "text-red-600", rows: dated.filter((c) => c.membership.daysLeft! < 0).sort((a, b) => byDate(b, a)) },
    { key: "week", title: "Vencen en los próximos 7 días", tone: "text-orange-600", rows: dated.filter((c) => c.membership.daysLeft! >= 0 && c.membership.daysLeft! <= 7).sort(byDate) },
    { key: "month", title: "Vencen en 8 a 30 días", tone: "text-amber-600", rows: dated.filter((c) => c.membership.daysLeft! > 7 && c.membership.daysLeft! <= 30).sort(byDate) },
    { key: "later", title: "Más de 30 días", tone: "text-emerald-600", rows: dated.filter((c) => c.membership.daysLeft! > 30).sort(byDate) },
    { key: "none", title: "Sin fecha de vencimiento", tone: "text-gray-500", rows: clients.filter((c) => c.membership.daysLeft === null) },
  ]
  const balances = !isAdmin ? [] : clients
    .filter((c) => c.pendingBalance)
    .sort((a, b) => (a.pendingBalance!.dueDate ?? "9999").localeCompare(b.pendingBalance!.dueDate ?? "9999"))

  return (
    <div className={cn("max-w-2xl mx-auto space-y-4", isAdmin ? "pb-20" : "p-4")}>
      <div>
        <h1 className="text-xl font-bold">Vencimientos</h1>
        <p className="text-sm text-gray-500">
          {groups[0].rows.length} vencidos · {groups[1].rows.length} esta semana · {groups[2].rows.length} este mes
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {groups.filter((g) => g.rows.length).map((g) => (
          <a key={g.key} href={`#${g.key}`} className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700">
            {g.title.replace("Vencen en los próximos", "").replace("Vencen en", "")} <b>{g.rows.length}</b>
          </a>
        ))}
        <Link
          href={showStandby ? self : `${self}?standby=1`}
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
              const m = c.membership
              const days = m.daysLeft
              return (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Link href={isAdmin ? `/coaching/clients/${c.id}?tab=membership` : `/trainer/clients/${c.id}?tab=ep`} className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">
                      {c.name}
                      {c.status === "STANDBY" && <span className="ml-1.5 text-[10px] font-normal text-gray-400">stand-by</span>}
                      {c.status === "PAUSED" && <span className="ml-1.5 text-[10px] font-normal text-gray-400">pausado</span>}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{m.planName ?? "Sin plan"}</p>
                    {m.end && days !== null && (
                      <p className={cn("text-xs font-medium", g.tone)}>
                        {formatYmdLong(m.end)} · {whenLabel(days)}
                      </p>
                    )}
                  </Link>
                  {c.phone && days !== null && days <= 30 && (
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
