import { prisma } from "@/lib/prisma"
import { periodLabel } from "./dates"
import { notifyClient } from "./notify"

/**
 * Marca una mensualidad como pagada y registra el ingreso en Finanzas (categoría COACHING).
 * Es idempotente: si ya estaba pagada devuelve null sin duplicar el ingreso.
 */
export async function markPaymentPaid(id: string, opts: { amount?: number; paidAt?: Date; method: string; mpPaymentId?: string }) {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.coachingPayment.findUnique({ where: { id }, include: { client: { select: { firstName: true, lastName: true } } } })
    if (!payment) return null
    const amount = opts.amount ?? payment.amount
    const paidAt = opts.paidAt ?? new Date()
    // Bloqueo optimista: solo una transición PENDING → PAID gana
    const claimed = await tx.coachingPayment.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "PAID", paidAt, amount, method: opts.method, mpPaymentId: opts.mpPaymentId ?? null },
    })
    if (!claimed.count) return null
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
    return tx.coachingPayment.update({ where: { id }, data: { incomeId: income.id } })
  })
  if (result) {
    await notifyClient(result.clientId, { type: "PAYMENT", title: "Pago registrado ✅", body: `Mensualidad de ${periodLabel(result.period)}. ¡Gracias!`, link: "/app/profile" })
  }
  return result
}
