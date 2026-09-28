import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { currentPeriod, periodLabel, toYmd, todayYmd } from "@/lib/coaching/dates"
import { Panel, Stat } from "@/components/coaching/kit"
import PaymentsTable from "@/components/coaching/PaymentsTable"
import { mpEnabled } from "@/lib/coaching/mercadopago"
import GenerateMonth from "./GenerateMonth"

export const dynamic = "force-dynamic"

function shift(period: string, n: number) {
  const [y, m] = period.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

export default async function CoachingPaymentsPage({ searchParams }: PageProps<"/coaching/payments">) {
  const sp = await searchParams
  const period = typeof sp.period === "string" && /^\d{4}-\d{2}$/.test(sp.period) ? sp.period : currentPeriod()
  const [payments, profiles, overdue] = await Promise.all([
    prisma.coachingPayment.findMany({ where: { period }, include: { client: { select: { firstName: true, lastName: true } } }, orderBy: [{ status: "asc" }, { dueDate: "asc" }] }),
    prisma.coachingProfile.findMany({ where: { status: "ACTIVE" }, select: { clientId: true, price: true } }),
    prisma.coachingPayment.findMany({ where: { status: "PENDING", period: { lt: period } }, include: { client: { select: { firstName: true, lastName: true } } }, orderBy: { dueDate: "asc" } }),
  ])
  const paid = payments.filter((p) => p.status === "PAID")
  const pending = payments.filter((p) => p.status === "PENDING")
  const expected = profiles.reduce((a, p) => a + (p.price ?? 0), 0)
  const missing = profiles.filter((p) => p.price && !payments.some((x) => x.clientId === p.clientId)).length
  const today = todayYmd()
  const toRow = (p: (typeof payments)[number]) => ({
    id: p.id, clientId: p.clientId, clientName: `${p.client.firstName} ${p.client.lastName}`, period: p.period, periodLabel: periodLabel(p.period),
    amount: p.amount, currency: p.currency, status: p.status, dueDate: toYmd(p.dueDate), paidAt: p.paidAt ? toYmd(p.paidAt) : null, method: p.method,
  })

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`?period=${shift(period, -1)}`} className="px-2 py-1 rounded hover:bg-gray-100">←</Link>
          <h1 className="text-xl font-bold">Pagos · {periodLabel(period)}</h1>
          <Link href={`?period=${shift(period, 1)}`} className="px-2 py-1 rounded hover:bg-gray-100">→</Link>
        </div>
        <GenerateMonth period={period} missing={missing} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Cobrado" value={`S/${paid.reduce((a, p) => a + p.amount, 0).toLocaleString("es-PE")}`} tone="green" hint={`${paid.length} pagos`} />
        <Stat label="Pendiente" value={`S/${pending.reduce((a, p) => a + p.amount, 0).toLocaleString("es-PE")}`} tone="yellow" hint={`${pending.length} por cobrar`} />
        <Stat label="Vencidos" value={pending.filter((p) => toYmd(p.dueDate) < today).length} tone="red" />
        <Stat label="Ingreso esperado" value={`S/${expected.toLocaleString("es-PE")}`} hint={`${profiles.length} clientes activos`} />
      </div>
      <Panel title="Mensualidades del mes">
        <PaymentsTable mpEnabled={mpEnabled()} payments={payments.map(toRow)} showClient />
      </Panel>
      {overdue.length > 0 && (
        <Panel title={`⚠️ Deudas de meses anteriores (${overdue.length})`}>
          <PaymentsTable mpEnabled={mpEnabled()} payments={overdue.map(toRow)} showClient />
        </Panel>
      )}
      <p className="text-xs text-gray-400">Al marcar un pago como pagado se registra automáticamente como ingreso “Coaching online” en Finanzas.</p>
    </>
  )
}
