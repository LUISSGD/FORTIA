import { prisma } from "@/lib/prisma"
import { formatCurrency, formatDate, daysUntilExpiry, whatsappRenewalUrl } from "@/lib/utils"
import Header from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { TrendingUp, TrendingDown, DollarSign, Users, MessageCircle } from "lucide-react"
import { startOfMonth, endOfMonth, addDays } from "date-fns"
import ClearDataButton from "@/components/ui/ClearDataButton"

export default async function DashboardPage() {
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const sevenDays = addDays(now, 7)

  const [incomes, expenses, activeClients, expiringClients] = await Promise.all([
    prisma.income.findMany({ where: { date: { gte: monthStart, lte: monthEnd } }, select: { amount: true } }),
    prisma.expense.findMany({ where: { date: { gte: monthStart, lte: monthEnd } }, select: { amount: true } }),
    prisma.client.count({ where: { isActive: true } }),
    prisma.client.findMany({
      where: { isActive: true, membershipEnd: { gte: now, lte: sevenDays } },
      include: { membershipPlan: true },
      orderBy: { membershipEnd: "asc" },
    }),
  ])

  const revenueMTD = incomes.reduce((s, i) => s + i.amount, 0)
  const expensesMTD = expenses.reduce((s, e) => s + e.amount, 0)
  const netMTD = revenueMTD - expensesMTD

  const kpis = [
    { label: "Ingresos del mes", value: formatCurrency(revenueMTD), icon: TrendingUp, color: "bg-green-100 text-green-600" },
    { label: "Egresos del mes", value: formatCurrency(expensesMTD), icon: TrendingDown, color: "bg-red-100 text-red-600" },
    { label: "Neto del mes", value: formatCurrency(netMTD), icon: DollarSign, color: netMTD >= 0 ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600" },
    { label: "Clientes activos", value: String(activeClients), icon: Users, color: "bg-purple-100 text-purple-600" },
  ]

  return (
    <>
      <Header title="Dashboard" />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Bienvenido a FORTIA</h2>
          <ClearDataButton />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`${kpi.color} p-3 rounded-full`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{kpi.label}</p>
                  <p className="text-xl font-bold">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
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
              <p className="text-sm text-gray-400">No hay renovaciones en los próximos 7 días. ¡Todo en orden!</p>
            ) : (
              <div className="space-y-3">
                {expiringClients.map((client) => {
                  const days = daysUntilExpiry(client.membershipEnd)
                  const fullName = `${client.firstName} ${client.lastName}`
                  const waUrl = whatsappRenewalUrl(client.phone, fullName, client.membershipEnd)

                  return (
                    <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-100">
                      <div>
                        <Link href={`/clients/${client.id}`} className="font-medium text-sm hover:text-orange-600">
                          {fullName}
                        </Link>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {client.membershipPlan?.name} · Vence: {formatDate(client.membershipEnd)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={days !== null && days <= 5 ? "bg-red-500" : "bg-yellow-500"}>
                          {days !== null && days >= 0 ? `${days} días` : "Vencido"}
                        </Badge>
                        {client.phone && (
                          <a href={waUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="gap-1 text-green-600 border-green-200 hover:bg-green-50">
                              <MessageCircle className="h-3 w-3" />
                              WA
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
