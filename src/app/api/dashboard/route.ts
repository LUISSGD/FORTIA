import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { startOfMonth, endOfMonth, addDays } from "date-fns"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const sevenDaysLater = addDays(now, 7)

  const [incomes, expenses, activeClients, expiringClients] = await Promise.all([
    prisma.income.findMany({ where: { date: { gte: monthStart, lte: monthEnd } }, select: { amount: true } }),
    prisma.expense.findMany({ where: { date: { gte: monthStart, lte: monthEnd } }, select: { amount: true } }),
    prisma.client.count({ where: { isActive: true } }),
    prisma.client.findMany({
      where: { isActive: true, membershipEnd: { gte: now, lte: sevenDaysLater } },
      include: { membershipPlan: true },
      orderBy: { membershipEnd: "asc" },
    }),
  ])

  const revenueMTD = incomes.reduce((sum, i) => sum + i.amount, 0)
  const expensesMTD = expenses.reduce((sum, e) => sum + e.amount, 0)

  return NextResponse.json({
    revenueMTD,
    expensesMTD,
    netMTD: revenueMTD - expensesMTD,
    activeClients,
    expiringClients,
  })
}
