import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const debts = await prisma.debt.findMany({
    where: { isActive: true },
    include: { payments: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(debts)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const body = await request.json()
  const debt = await prisma.debt.create({
    data: {
      name: body.name,
      creditor: body.creditor || null,
      totalAmount: Number(body.totalAmount),
      currency: body.currency ?? "PEN",
      monthlyPayment: body.monthlyPayment ? Number(body.monthlyPayment) : null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      notes: body.notes || null,
    },
  })
  return NextResponse.json(debt, { status: 201 })
}
