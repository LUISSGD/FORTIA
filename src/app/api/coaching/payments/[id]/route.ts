import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError, num, str } from "@/lib/coaching/auth"
import { markPaymentPaid } from "@/lib/coaching/payments"

type Params = { params: Promise<{ id: string }> }

/** Marcar como pagado registra el ingreso en Finanzas (categoría COACHING); revertir lo elimina. */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const body = await request.json()
  const payment = await prisma.coachingPayment.findUnique({ where: { id }, include: { client: { select: { firstName: true, lastName: true } } } })
  if (!payment) return jsonError("No encontrado", 404)

  if (body.status === "PAID" && payment.status !== "PAID") {
    const updated = await markPaymentPaid(id, {
      amount: num(body.amount) ?? payment.amount,
      paidAt: body.paidAt ? new Date(`${body.paidAt}T12:00:00Z`) : new Date(),
      method: str(body.method) ?? "TRANSFER",
    })
    return NextResponse.json(updated ?? payment)
  }

  if (body.status === "PENDING" && payment.status === "PAID") {
    const updated = await prisma.$transaction(async (tx) => {
      if (payment.incomeId) await tx.income.deleteMany({ where: { id: payment.incomeId } })
      return tx.coachingPayment.update({ where: { id }, data: { status: "PENDING", paidAt: null, method: null, incomeId: null, mpPaymentId: null } })
    })
    return NextResponse.json(updated)
  }

  const updated = await prisma.coachingPayment.update({
    where: { id },
    data: {
      ...(body.notes !== undefined ? { notes: str(body.notes) } : {}),
      ...(body.dueDate ? { dueDate: new Date(`${body.dueDate}T12:00:00Z`) } : {}),
      ...(payment.status === "PENDING" && num(body.amount) ? { amount: num(body.amount)! } : {}),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const payment = await prisma.coachingPayment.delete({ where: { id } })
  if (payment.incomeId) await prisma.income.deleteMany({ where: { id: payment.incomeId } })
  return NextResponse.json({ ok: true })
}
