import { prisma } from "@/lib/prisma"
import { formatCurrency, formatDate, INCOME_CATEGORIES } from "@/lib/utils"
import Header from "@/components/layout/Header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Plus } from "lucide-react"
import DeleteButton from "@/components/ui/DeleteButton"

export default async function IncomePage() {
  const incomes = await prisma.income.findMany({
    orderBy: { date: "desc" },
    include: { client: { select: { firstName: true, lastName: true } } },
    take: 100,
  })

  const total = incomes.reduce((s, i) => s + i.amount, 0)

  return (
    <>
      <Header title="Ingresos" />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Registro de ingresos</h2>
            <p className="text-sm text-gray-500 mt-1">Total mostrado: <span className="font-semibold text-green-600">{formatCurrency(total)}</span></p>
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
                  <TableCell className="text-right font-semibold text-green-600">{formatCurrency(i.amount)}</TableCell>
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
