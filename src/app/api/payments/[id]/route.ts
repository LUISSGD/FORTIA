import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { deletePayment } from "@/lib/finance-sync"
import { calendarDate, calendarYmd } from "@/lib/calendar"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const payment = await prisma.payment.findUnique({ where: { id }, include: { income: { select: { category: true } } } })
  if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (body.amount !== undefined) data.amount = Number(body.amount)
  if (body.method !== undefined) data.method = body.method
  if (body.concept !== undefined) data.concept = body.concept
  if ("receiptUrl" in body) data.receiptUrl = body.receiptUrl ?? null
  // Fecha del pago: mueve también el ingreso en Finanzas a ese día (y por tanto a ese mes)
  const paidAt = typeof body.paidAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.paidAt) ? calendarDate(body.paidAt) : null
  if (paidAt) {
    data.paidAt = paidAt
    // Clases EP y nutrición no cubren un período: su "período" es el día del pago
    const oneDay = payment.income?.category !== "MEMBERSHIP" && payment.method !== "EXTENSION" && calendarYmd(payment.periodStart) === calendarYmd(payment.periodEnd)
    if (oneDay) Object.assign(data, { periodStart: paidAt, periodEnd: paidAt })
  }

  const updated = await prisma.payment.update({ where: { id }, data })

  // Mantener el ingreso de Finanzas igual al pago (monto y fecha)
  if ((body.amount !== undefined || paidAt) && payment.incomeId) {
    await prisma.income.update({
      where: { id: payment.incomeId },
      data: { ...(body.amount !== undefined ? { amount: Number(body.amount) } : {}), ...(paidAt ? { date: paidAt } : {}) },
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
