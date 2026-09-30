import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, cn } from "@/lib/utils"
import { currentPeriod, formatYmd, limaDateTime, periodLabel, toYmd } from "@/lib/coaching/dates"
import { Panel, Stat } from "@/components/coaching/kit"
import DeleteButton from "@/components/ui/DeleteButton"

export const dynamic = "force-dynamic"

// Finanzas del gimnasio dentro del coaching. Es la misma información que el
// módulo Finanzas: lo que se registre o borre aquí se refleja allá y viceversa.

function shift(period: string, n: number) {
  const [y, m] = period.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}
const money = (n: number, currency = "PEN") => `${currency === "USD" ? "$" : "S/"} ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default async function CoachingFinancesPage({ searchParams }: PageProps<"/coaching/finances">) {
  const sp = await searchParams
  const period = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : currentPeriod()
  const range = { gte: limaDateTime(`${period}-01`, "00:00"), lt: limaDateTime(`${shift(period, 1)}-01`, "00:00") }

  const [incomes, expenses, coachingClients] = await Promise.all([
    prisma.income.findMany({
      where: { date: range },
      include: { client: { select: { id: true, firstName: true, lastName: true } }, payment: { select: { id: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.expense.findMany({ where: { date: range }, orderBy: { date: "desc" } }),
    prisma.coachingProfile.findMany({ select: { clientId: true } }),
  ])
  const inCoaching = new Set(coachingClients.map((c) => c.clientId))

  const sum = (list: { amount: number; currency: string }[], cur: string) => list.filter((x) => x.currency === cur).reduce((a, x) => a + x.amount, 0)
  const incomePEN = sum(incomes, "PEN"), incomeUSD = sum(incomes, "USD")
  const expensePEN = sum(expenses, "PEN"), expenseUSD = sum(expenses, "USD")
  const byCategory = Object.entries(
    incomes.filter((i) => i.currency === "PEN").reduce<Record<string, number>>((a, i) => ({ ...a, [i.category]: (a[i.category] ?? 0) + i.amount }), {}),
  ).sort((a, b) => b[1] - a[1])
  // Ingresos de membresía / entrenamiento personal cuyo pago ya no existe en la ficha del cliente.
  const orphan = (i: (typeof incomes)[number]) => (i.category === "MEMBERSHIP" || i.category === "PERSONAL_TRAINING") && !!i.clientId && !i.payment
  const orphans = incomes.filter(orphan).length

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`?month=${shift(period, -1)}`} className="px-2 py-1 rounded hover:bg-gray-100">←</Link>
          <h1 className="text-xl font-bold">Finanzas · {periodLabel(period)}</h1>
          <Link href={`?month=${shift(period, 1)}`} className="px-2 py-1 rounded hover:bg-gray-100">→</Link>
        </div>
        <div className="flex gap-2">
          <Link href="/finances/income/new" className="text-xs font-medium rounded-lg bg-emerald-500 text-white px-3 py-2 hover:bg-emerald-600">+ Ingreso</Link>
          <Link href="/finances/expenses/new" className="text-xs font-medium rounded-lg bg-red-500 text-white px-3 py-2 hover:bg-red-600">+ Egreso</Link>
          <Link href="/finances/reports" className="text-xs font-medium rounded-lg border border-gray-300 bg-white px-3 py-2 hover:bg-gray-50">Reportes</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Ingresos" value={money(incomePEN)} tone="green" hint={incomeUSD ? `+ ${money(incomeUSD, "USD")}` : `${incomes.length} movimientos`} />
        <Stat label="Egresos" value={money(expensePEN)} tone="red" hint={expenseUSD ? `+ ${money(expenseUSD, "USD")}` : `${expenses.length} movimientos`} />
        <Stat label="Neto" value={money(incomePEN - expensePEN)} tone={incomePEN - expensePEN >= 0 ? "default" : "orange"} hint={incomeUSD || expenseUSD ? `${money(incomeUSD - expenseUSD, "USD")} en dólares` : undefined} />
        <Stat label="Por tipo" value={<span className="text-sm font-medium block space-y-0.5">{byCategory.slice(0, 3).map(([k, v]) => <span key={k} className="block">{INCOME_CATEGORIES[k] ?? k}: {money(v)}</span>)}{!byCategory.length && "—"}</span>} />
      </div>

      {orphans > 0 && (
        <p className="text-sm rounded-xl bg-amber-50 text-amber-800 px-4 py-3">
          ⚠️ {orphans} ingreso(s) de membresía o entrenamiento ya no tienen su pago en la ficha del cliente (marcados abajo). Si fueron un error, bórralos aquí.
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Panel title={`Ingresos (${incomes.length})`}>
          <div className="divide-y divide-gray-100">
            {incomes.map((i) => (
              <div key={i.id} className={cn("flex items-center gap-3 py-2.5", orphan(i) && "bg-amber-50/60 -mx-2 px-2 rounded")}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{i.description ?? INCOME_CATEGORIES[i.category]}</p>
                  <p className="text-xs text-gray-500 flex flex-wrap gap-x-2">
                    <span>{formatYmd(toYmd(i.date), true)}</span>
                    <span className="bg-gray-100 rounded px-1.5">{INCOME_CATEGORIES[i.category] ?? i.category}</span>
                    {i.client && (
                      <Link href={inCoaching.has(i.client.id) ? `/coaching/clients/${i.client.id}?tab=membership` : `/clients/${i.client.id}`} className="text-orange-600 hover:underline">
                        {i.client.firstName} {i.client.lastName}
                      </Link>
                    )}
                    {orphan(i) && <span className="text-amber-700">⚠️ sin pago en la ficha</span>}
                  </p>
                </div>
                <span className="text-sm font-semibold text-emerald-600 whitespace-nowrap">{money(i.amount, i.currency)}</span>
                <DeleteButton
                  url={`/api/finances/income/${i.id}`}
                  confirm={i.payment ? "¿Eliminar este ingreso? También se borra el pago en la ficha del cliente y, si renovó la membresía, vuelve a su fecha anterior." : "¿Eliminar este ingreso?"}
                />
              </div>
            ))}
            {!incomes.length && <p className="text-sm text-gray-500 py-6 text-center">Sin ingresos este mes.</p>}
          </div>
        </Panel>

        <Panel title={`Egresos (${expenses.length})`}>
          <div className="divide-y divide-gray-100">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.description ?? EXPENSE_CATEGORIES[e.category]}</p>
                  <p className="text-xs text-gray-500 flex flex-wrap gap-x-2">
                    <span>{formatYmd(toYmd(e.date), true)}</span>
                    <span className="bg-gray-100 rounded px-1.5">{EXPENSE_CATEGORIES[e.category] ?? e.category}</span>
                    {e.vendor && <span>{e.vendor}</span>}
                  </p>
                </div>
                <span className="text-sm font-semibold text-red-600 whitespace-nowrap">{money(e.amount, e.currency)}</span>
                <DeleteButton url={`/api/finances/expenses/${e.id}`} confirm="¿Eliminar este egreso?" />
              </div>
            ))}
            {!expenses.length && <p className="text-sm text-gray-500 py-6 text-center">Sin egresos este mes.</p>}
          </div>
        </Panel>
      </div>
      <p className="text-xs text-gray-400">Es la misma información del módulo Finanzas: lo que registres o borres aquí se refleja allá, en la ficha del cliente y en su membresía.</p>
    </>
  )
}
