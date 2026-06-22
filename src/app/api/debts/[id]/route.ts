import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(_req: Request, ctx: RouteContext<"/api/debts/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  const debt = await prisma.debt.findUnique({
    where: { id },
    include: { payments: { orderBy: { date: "desc" } } },
  })
  if (!debt) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(debt)
}

export async function PUT(request: Request, ctx: RouteContext<"/api/debts/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  const body = await request.json()
  const debt = await prisma.debt.update({
    where: { id },
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
  return NextResponse.json(debt)
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/debts/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  await prisma.debt.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
