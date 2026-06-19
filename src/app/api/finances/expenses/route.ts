import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const category = searchParams.get("category")

  const expenses = await prisma.expense.findMany({
    where: {
      ...(startDate && { date: { gte: new Date(startDate) } }),
      ...(endDate && { date: { lte: new Date(endDate) } }),
      ...(category && { category }),
    },
    orderBy: { date: "desc" },
  })
  return NextResponse.json(expenses)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const body = await request.json()
  const expense = await prisma.expense.create({
    data: {
      amount: Number(body.amount),
      currency: body.currency ?? "PEN",
      category: body.category ?? "OTHER",
      description: body.description ?? null,
      vendor: body.vendor ?? null,
      date: body.date ? new Date(body.date) : new Date(),
    },
  })
  return NextResponse.json(expense, { status: 201 })
}
