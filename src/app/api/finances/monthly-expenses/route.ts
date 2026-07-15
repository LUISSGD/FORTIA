import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = Number(searchParams.get("month"))
  const year = Number(searchParams.get("year"))

  const items = await prisma.monthlyExpense.findMany({
    where: { month, year },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(items)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await request.json()
  const item = await prisma.monthlyExpense.create({
    data: {
      concept: body.concept,
      currency: body.currency ?? "PEN",
      amount: Number(body.amount),
      month: Number(body.month),
      year: Number(body.year),
      status: body.status ?? "PENDIENTE",
      notes: body.notes || null,
    },
  })
  return NextResponse.json(item, { status: 201 })
}
