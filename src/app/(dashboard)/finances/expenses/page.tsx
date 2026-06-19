import { prisma } from "@/lib/prisma"
import { formatDate, EXPENSE_CATEGORIES } from "@/lib/utils"
import Header from "@/components/layout/Header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Plus } from "lucide-react"
import DeleteButton from "@/components/ui/DeleteButton"

function formatAmount(amount: number, currency: string) {
  if (currency === "USD") return `$ ${amount.toFixed(2)}`
  return `S/ ${amount.toFixed(2)}`
}

export default async function ExpensesPage() {
  const expenses = await prisma.expense.findMany({
    orderBy: { date: "desc" },
    take: 100,
  })

  const totalPEN = expenses.filter((e) => e.currency === "PEN").reduce((s, e) => s + e.amount, 0)
  const totalUSD = expenses.filter((e) => e.currency === "USD").reduce((s, e) => s + e.amount, 0)

  return (
    <>
      <Header title="Egresos" />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Registro de egresos</h2>
            <div className="flex gap-4 mt-1">
              <p className="text-sm text-gray-500">Soles: <span className="font-semibold text-red-600">S/ {totalPEN.toFixed(2)}</span></p>
              {totalUSD > 0 && (
                <p className="text-sm text-gray-500">Dólares: <span className="font-semibold text-red-600">$ {totalUSD.toFixed(2)}</span></p>
              )}
            </div>
          </div>
          <Link href="/finances/expenses/new">
            <Button className="bg-red-500 hover:bg-red-600">
              <Plus className="h-4 w-4 mr-2" />Registrar egreso
            </Button>
          </Link>
        </div>
        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-gray-600 whitespace-nowrap">{formatDate(e.date)}</TableCell>
                  <TableCell>{e.description ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{EXPENSE_CATEGORIES[e.category] ?? e.category}</Badge></TableCell>
                  <TableCell className="text-gray-600">{e.vendor ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold text-red-600">
                    {formatAmount(e.amount, e.currency)}
                    {e.currency === "USD" && <span className="ml-1 text-xs text-blue-500 font-normal">USD</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteButton url={`/api/finances/expenses/${e.id}`} confirm="¿Eliminar este egreso?" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {expenses.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">Sin registros de egresos.</p>}
        </div>
      </main>
    </>
  )
}
