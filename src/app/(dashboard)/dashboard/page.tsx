import { prisma } from "@/lib/prisma"
import { formatDate, daysUntilExpiry, whatsappRenewalUrl } from "@/lib/utils"
import Header from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { TrendingUp, TrendingDown, Users, MessageCircle } from "lucide-react"
import { startOfMonth, endOfMonth, addDays } from "date-fns"
import ClearDataButton from "@/components/ui/ClearDataButton"

export default async function DashboardPage() {
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const sevenDays = addDays(now, 7)

  const [incomes, expenses, activeClients, expiringClients] = await Promise.all([
    prisma.income.findMany({ where: { date: { gte: monthStart, lte: monthEnd } }, select: { amount: true, currency: true } }),
    prisma.expense.findMany({ where: { date: { gte: monthStart, lte: monthEnd } }, select: { amount: true, currency: true } }),
    prisma.client.count({ where: { isActive: true } }),
    prisma.client.findMany({
      where: { isActive: true, membershipEnd: { gte: now, lte: sevenDays } },
      include: { membershipPlan: true },
      orderBy: { membershipEnd: "asc" },
    }),
  ])

  const incomePEN = incomes.filter(i => i.currency === "PEN").reduce((s, i) => s + i.amount, 0)
  const incomeUSD = incomes.filter(i => i.currency === "USD").reduce((s, i) => s + i.amount, 0)
  const expensePEN = expenses.filter(e => e.currency === "PEN").reduce((s, e) => s + e.amount, 0)
  const expenseUSD = expenses.filter(e => e.currency === "USD").reduce((s, e) => s + e.amount, 0)

  function fmt(pen: number, usd: number) {
    if (usd > 0) return `S/ ${pen.toFixed(2)} + $ ${usd.toFixed(2)}`
    return `S/ ${pen.toFixed(2)}`
  }

  return (
    <>
      <Header title="Dashboard" />
      <main className="flex-1 p-3 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Bienvenido a FORTIA</h2>
          <ClearDataButton />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="bg-green-100 text-green-600 p-3 rounded-full"><TrendingUp className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-gray-500">Ingresos del mes</p>
                <p className="text-lg font-bold text-green-600">S/ {incomePEN.toFixed(2)}</p>
                {incomeUSD > 0 && <p className="text-sm font-semibold text-green-500">$ {incomeUSD.toFixed(2)}</p>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="bg-red-100 text-red-600 p-3 rounded-full"><TrendingDown className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-gray-500">Egresos del mes</p>
                <p className="text-lg font-bold text-red-600">S/ {expensePEN.toFixed(2)}</p>
                {expenseUSD > 0 && <p className="text-sm font-semibold text-red-500">$ {expenseUSD.toFixed(2)}</p>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="bg-purple-100 text-purple-600 p-3 rounded-full"><Users className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-gray-500">Clientes activos</p>
                <p className="text-xl font-bold">{activeClients}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Neto del mes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Card className="border-blue-100">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-1">Neto del mes (S/)</p>
              <p className={`text-xl font-bold ${(incomePEN - expensePEN) >= 0 ? "text-blue-600" : "text-orange-600"}`}>
                S/ {(incomePEN - expensePEN).toFixed(2)}
              </p>
            </CardContent>
          </Card>
          {(incomeUSD > 0 || expenseUSD > 0) && (
            <Card className="border-blue-100">
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 mb-1">Neto del mes ($)</p>
                <p className={`text-xl font-bold ${(incomeUSD - expenseUSD) >= 0 ? "text-blue-600" : "text-orange-600"}`}>
                  $ {(incomeUSD - expenseUSD).toFixed(2)}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Renewal Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">
              Renovaciones próximas
              {expiringClients.length > 0 && (
                <Badge className="ml-2 bg-orange-500">{expiringClients.length}</Badge>
              )}
            </CardTitle>
            <Link href="/clients">
              <Button variant="outline" size="sm">Ver todos los clientes</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {expiringClients.length === 0 ? (
              <p className="text-sm text-gray-400">No hay renovaciones en los próximos 7 días.</p>
            ) : (
              <div className="space-y-3">
                {expiringClients.map((client) => {
                  const days = daysUntilExpiry(client.membershipEnd)
                  const fullName = `${client.firstName} ${client.lastName}`
                  const waUrl = whatsappRenewalUrl(client.phone, fullName, client.membershipEnd)
                  return (
                    <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-100">
                      <div>
                        <Link href={`/clients/${client.id}`} className="font-medium text-sm hover:text-orange-600">{fullName}</Link>
                        <p className="text-xs text-gray-500 mt-0.5">{client.membershipPlan?.name} · Vence: {formatDate(client.membershipEnd)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={days !== null && days <= 5 ? "bg-red-500" : "bg-yellow-500"}>
                          {days !== null && days >= 0 ? `${days} días` : "Vencido"}
                        </Badge>
                        {client.phone && (
                          <a href={waUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="gap-1 text-green-600 border-green-200 hover:bg-green-50">
                              <MessageCircle className="h-3 w-3" />WA
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
