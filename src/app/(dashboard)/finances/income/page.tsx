import { prisma } from "@/lib/prisma"
import { formatDate, INCOME_CATEGORIES } from "@/lib/utils"
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

export default async function IncomePage() {
  const incomes = await prisma.income.findMany({
    orderBy: { date: "desc" },
    include: { client: { select: { firstName: true, lastName: true } } },
    take: 100,
  })

  const totalPEN = incomes.filter((i) => i.currency === "PEN").reduce((s, i) => s + i.amount, 0)
  const totalUSD = incomes.filter((i) => i.currency === "USD").reduce((s, i) => s + i.amount, 0)

  return (
    <>
      <Header title="Ingresos" />
      <main className="flex-1 p-3 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Registro de ingresos</h2>
            <div className="flex gap-4 mt-1">
              <p className="text-sm text-gray-500">Soles: <span className="font-semibold text-green-600">S/ {totalPEN.toFixed(2)}</span></p>
              {totalUSD > 0 && (
                <p className="text-sm text-gray-500">Dólares: <span className="font-semibold text-green-600">$ {totalUSD.toFixed(2)}</span></p>
              )}
            </div>
          </div>
          <Link href="/finances/income/new">
            <Button className="bg-green-500 hover:bg-green-600">
              <Plus className="h-4 w-4 mr-2" />Registrar ingreso
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
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomes.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-gray-600 whitespace-nowrap">{formatDate(i.date)}</TableCell>
                  <TableCell>{i.description ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{INCOME_CATEGORIES[i.category] ?? i.category}</Badge></TableCell>
                  <TableCell className="text-gray-600">
                    {i.client ? `${i.client.firstName} ${i.client.lastName}` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-green-600">
                    {formatAmount(i.amount, i.currency)}
                    {i.currency === "USD" && <span className="ml-1 text-xs text-blue-500 font-normal">USD</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteButton url={`/api/finances/income/${i.id}`} confirm="¿Eliminar este ingreso?" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {incomes.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">Sin registros de ingresos.</p>}
        </div>
      </main>
    </>
  )
}
