import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns"
import { es } from "date-fns/locale"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const months = Number(searchParams.get("months") ?? "6")

  const now = new Date()
  const data = []

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = subMonths(now, i)
    const start = startOfMonth(monthDate)
    const end = endOfMonth(monthDate)

    const [incomeResult, expenseResult] = await Promise.all([
      prisma.income.findMany({ where: { date: { gte: start, lte: end } }, select: { amount: true } }),
      prisma.expense.findMany({ where: { date: { gte: start, lte: end } }, select: { amount: true } }),
    ])

    const totalIncome = incomeResult.reduce((sum, r) => sum + r.amount, 0)
    const totalExpenses = expenseResult.reduce((sum, r) => sum + r.amount, 0)

    data.push({
      month: format(monthDate, "MMM yy", { locale: es }),
      ingresos: totalIncome,
      egresos: totalExpenses,
      neto: totalIncome - totalExpenses,
    })
  }

  return NextResponse.json(data)
}
