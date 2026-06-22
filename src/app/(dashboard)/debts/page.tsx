import { prisma } from "@/lib/prisma"
import Header from "@/components/layout/Header"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, TrendingDown, AlertCircle } from "lucide-react"
import { formatDate } from "@/lib/utils"

function formatMoney(amount: number, currency: string) {
  return currency === "USD" ? `$ ${amount.toFixed(2)}` : `S/ ${amount.toFixed(2)}`
}

export default async function DebtsPage() {
  const debts = await prisma.debt.findMany({
    where: { isActive: true },
    include: { payments: true },
    orderBy: { createdAt: "desc" },
  })

  const totalDebtPEN = debts.filter(d => d.currency === "PEN").reduce((s, d) => s + d.totalAmount, 0)
  const totalDebtUSD = debts.filter(d => d.currency === "USD").reduce((s, d) => s + d.totalAmount, 0)

  const paidPEN = debts.filter(d => d.currency === "PEN").reduce((s, d) => {
    return s + d.payments.filter(p => p.currency === "PEN").reduce((ps, p) => ps + p.amount, 0)
  }, 0)
  const paidUSD = debts.filter(d => d.currency === "USD").reduce((s, d) => {
    return s + d.payments.filter(p => p.currency === "USD").reduce((ps, p) => ps + p.amount, 0)
  }, 0)

  return (
    <>
      <Header title="Deudas y Préstamos" />
      <main className="flex-1 p-3 md:p-6">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-red-100 p-3 rounded-full"><TrendingDown className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Total deuda (S/)</p>
                <p className="text-xl font-bold text-red-600">S/ {(totalDebtPEN - paidPEN).toFixed(2)}</p>
                <p className="text-xs text-gray-400">de S/ {totalDebtPEN.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          {totalDebtUSD > 0 && (
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="bg-red-100 p-3 rounded-full"><TrendingDown className="h-5 w-5 text-red-600" /></div>
                <div>
                  <p className="text-sm text-gray-500">Total deuda ($)</p>
                  <p className="text-xl font-bold text-red-600">$ {(totalDebtUSD - paidUSD).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">de $ {totalDebtUSD.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Obligaciones financieras ({debts.length})</h2>
          <Link href="/debts/new">
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />Nueva deuda
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {debts.map((debt) => {
            const paid = debt.payments.reduce((s, p) => s + p.amount, 0)
            const remaining = Math.max(debt.totalAmount - paid, 0)
            const pct = Math.min((paid / debt.totalAmount) * 100, 100)
            const isOverdue = debt.dueDate && new Date(debt.dueDate) < new Date() && remaining > 0

            return (
              <Link key={debt.id} href={`/debts/${debt.id}`}>
                <Card className={`hover:shadow-md transition-shadow cursor-pointer ${isOverdue ? "border-red-300" : ""}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-tight">{debt.name}</CardTitle>
                      {isOverdue && <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />}
                    </div>
                    {debt.creditor && <p className="text-xs text-gray-500">{debt.creditor}</p>}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Saldo pendiente</span>
                      <span className="font-bold text-red-600">{formatMoney(remaining, debt.currency)}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Pagado: {formatMoney(paid, debt.currency)}</span>
                        <span>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Total: {formatMoney(debt.totalAmount, debt.currency)}</span>
                      {debt.dueDate && (
                        <Badge variant={isOverdue ? "destructive" : "outline"} className="text-[10px]">
                          Vence: {formatDate(debt.dueDate)}
                        </Badge>
                      )}
                    </div>
                    {debt.monthlyPayment && (
                      <p className="text-xs text-gray-500">Cuota mensual: {formatMoney(debt.monthlyPayment, debt.currency)}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {debts.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <TrendingDown className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No hay deudas registradas.</p>
          </div>
        )}
      </main>
    </>
  )
}
