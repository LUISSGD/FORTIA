import { prisma } from "@/lib/prisma"
import { formatCurrency, formatDate, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/lib/utils"
import Header from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, DollarSign, BarChart2 } from "lucide-react"
import { startOfMonth, endOfMonth } from "date-fns"

export default async function FinancesPage() {
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      include: { client: { select: { firstName: true, lastName: true } } },
      orderBy: { date: "desc" },
      take: 10,
    }),
    prisma.expense.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: "desc" },
      take: 10,
    }),
  ])

  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const net = totalIncome - totalExpenses

  return (
    <>
      <Header title="Finanzas" />
      <main className="flex-1 p-3 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Resumen del mes</h2>
          <Link href="/finances/reports">
            <Button variant="outline" className="gap-2">
              <BarChart2 className="h-4 w-4" />Ver reportes
            </Button>
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-full"><TrendingUp className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Ingresos del mes</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-red-100 p-3 rounded-full"><TrendingDown className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Egresos del mes</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`${net >= 0 ? "bg-blue-100" : "bg-orange-100"} p-3 rounded-full`}>
                <DollarSign className={`h-5 w-5 ${net >= 0 ? "text-blue-600" : "text-orange-600"}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Neto del mes</p>
                <p className={`text-xl font-bold ${net >= 0 ? "text-blue-600" : "text-orange-600"}`}>{formatCurrency(net)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Incomes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Últimos ingresos</h3>
              <div className="flex gap-2">
                <Link href="/finances/income"><Button variant="outline" size="sm">Ver todos</Button></Link>
                <Link href="/finances/income/new"><Button size="sm" className="bg-green-500 hover:bg-green-600">+ Ingreso</Button></Link>
              </div>
            </div>
            <div className="space-y-2">
              {incomes.map((i) => (
                <div key={i.id} className="bg-white border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{i.description ?? INCOME_CATEGORIES[i.category]}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{INCOME_CATEGORIES[i.category] ?? i.category}</Badge>
                      <span className="text-xs text-gray-400">{formatDate(i.date)}</span>
                    </div>
                  </div>
                  <span className="font-semibold text-green-600">{formatCurrency(i.amount)}</span>
                </div>
              ))}
              {incomes.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin ingresos este mes.</p>}
            </div>
          </div>

          {/* Expenses */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Últimos egresos</h3>
              <div className="flex gap-2">
                <Link href="/finances/expenses"><Button variant="outline" size="sm">Ver todos</Button></Link>
                <Link href="/finances/expenses/new"><Button size="sm" className="bg-red-500 hover:bg-red-600">+ Egreso</Button></Link>
              </div>
            </div>
            <div className="space-y-2">
              {expenses.map((e) => (
                <div key={e.id} className="bg-white border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{e.description ?? EXPENSE_CATEGORIES[e.category]}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{EXPENSE_CATEGORIES[e.category] ?? e.category}</Badge>
                      {e.vendor && <span className="text-xs text-gray-400">{e.vendor}</span>}
                      <span className="text-xs text-gray-400">{formatDate(e.date)}</span>
                    </div>
                  </div>
                  <span className="font-semibold text-red-600">{formatCurrency(e.amount)}</span>
                </div>
              ))}
              {expenses.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin egresos este mes.</p>}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
