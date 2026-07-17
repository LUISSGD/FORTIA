import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const payment = await prisma.payment.findUnique({ where: { id } })
  if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (body.amount !== undefined) data.amount = Number(body.amount)
  if (body.method !== undefined) data.method = body.method
  if (body.concept !== undefined) data.concept = body.concept
  if ("receiptUrl" in body) data.receiptUrl = body.receiptUrl ?? null

  const updated = await prisma.payment.update({ where: { id }, data })

  // Sync income amount if amount changed
  if (body.amount !== undefined && payment.incomeId) {
    await prisma.income.update({
      where: { id: payment.incomeId },
      data: { amount: Number(body.amount) },
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params

  const payment = await prisma.payment.findUnique({ where: { id } })
  if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })

  // Delete payment first (FK constraint), then income
  await prisma.payment.delete({ where: { id } })
  if (payment.incomeId) {
    await prisma.income.delete({ where: { id: payment.incomeId } })
  }

  return NextResponse.json({ ok: true })
}
