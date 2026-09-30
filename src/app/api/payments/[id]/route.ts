import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { deletePayment } from "@/lib/finance-sync"

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

  // Borra el pago, su ingreso en Finanzas y devuelve la membresía a como estaba.
  const r = await deletePayment(id)
  if (!r.deleted) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })
  return NextResponse.json({ ok: true, membershipReverted: r.membershipReverted })
}
