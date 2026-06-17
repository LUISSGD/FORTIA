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

  const incomes = await prisma.income.findMany({
    where: {
      ...(startDate && { date: { gte: new Date(startDate) } }),
      ...(endDate && { date: { lte: new Date(endDate) } }),
      ...(category && { category }),
    },
    include: { client: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { date: "desc" },
  })
  return NextResponse.json(incomes)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const body = await request.json()
  const income = await prisma.income.create({
    data: {
      amount: Number(body.amount),
      category: body.category ?? "OTHER",
      description: body.description ?? null,
      clientId: body.clientId ?? null,
      date: body.date ? new Date(body.date) : new Date(),
    },
  })
  return NextResponse.json(income, { status: 201 })
}
