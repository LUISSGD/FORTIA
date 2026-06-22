import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(request: Request, ctx: RouteContext<"/api/debts/[id]/payments">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id: debtId } = await ctx.params
  const body = await request.json()
  const payment = await prisma.debtPayment.create({
    data: {
      debtId,
      amount: Number(body.amount),
      currency: body.currency ?? "PEN",
      notes: body.notes || null,
      date: body.date ? new Date(body.date) : new Date(),
    },
  })
  return NextResponse.json(payment, { status: 201 })
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/debts/[id]/payments">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const paymentId = searchParams.get("paymentId")
  if (!paymentId) return NextResponse.json({ error: "paymentId requerido" }, { status: 400 })
  await prisma.debtPayment.delete({ where: { id: paymentId } })
  return NextResponse.json({ ok: true })
}
