import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError, num, str } from "@/lib/coaching/auth"
import { notifyClient } from "@/lib/coaching/notify"
import { periodLabel } from "@/lib/coaching/dates"

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
    const paidAt = body.paidAt ? new Date(`${body.paidAt}T12:00:00Z`) : new Date()
    const amount = num(body.amount) ?? payment.amount
    const updated = await prisma.$transaction(async (tx) => {
      const income = await tx.income.create({
        data: {
          amount,
          currency: payment.currency,
          category: "COACHING",
          description: `Coaching ${periodLabel(payment.period)} — ${payment.client.firstName} ${payment.client.lastName}`,
          clientId: payment.clientId,
          date: paidAt,
        },
      })
      return tx.coachingPayment.update({ where: { id }, data: { status: "PAID", paidAt, amount, method: str(body.method) ?? "TRANSFER", incomeId: income.id } })
    })
    await notifyClient(payment.clientId, { type: "PAYMENT", title: "Pago registrado ✅", body: `Mensualidad de ${periodLabel(payment.period)}. ¡Gracias!`, link: "/app/profile" })
    return NextResponse.json(updated)
  }

  if (body.status === "PENDING" && payment.status === "PAID") {
    const updated = await prisma.$transaction(async (tx) => {
      if (payment.incomeId) await tx.income.deleteMany({ where: { id: payment.incomeId } })
      return tx.coachingPayment.update({ where: { id }, data: { status: "PENDING", paidAt: null, method: null, incomeId: null } })
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
