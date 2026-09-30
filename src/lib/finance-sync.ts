import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"

// Mantiene conectados pagos del cliente, membresía e ingresos de Finanzas:
// borrar desde cualquier lado deja todo coherente.

type Tx = Prisma.TransactionClient

/** Foto de la membresía del cliente, para guardarla en el pago antes de cambiarla. */
export async function membershipSnapshot(tx: Tx, clientId: string) {
  const c = await tx.client.findUnique({ where: { id: clientId }, select: { membershipPlanId: true, membershipStart: true, membershipEnd: true } })
  return {
    prevMembershipPlanId: c?.membershipPlanId ?? null,
    prevMembershipStart: c?.membershipStart ?? null,
    prevMembershipEnd: c?.membershipEnd ?? null,
    membershipApplied: true,
  }
}

const sameTime = (a: Date | null, b: Date | null) => !!a && !!b && Math.abs(a.getTime() - b.getTime()) < 1000

/** Borra un pago, su ingreso en Finanzas y, si ese pago fijó la membresía actual, la devuelve a como estaba. */
async function deletePaymentTx(tx: Tx, paymentId: string) {
  const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { income: { select: { category: true } } } })
  if (!payment) return { deleted: false, membershipReverted: false }

  await tx.payment.delete({ where: { id: paymentId } })
  if (payment.incomeId) await tx.income.deleteMany({ where: { id: payment.incomeId } })

  // ¿Este pago movió la membresía? (pagos de membresía y extensiones; no los de entrenamiento personal)
  const touchesMembership = payment.membershipApplied || payment.method === "EXTENSION" || payment.income?.category === "MEMBERSHIP"
  let membershipReverted = false
  if (touchesMembership) {
    const client = await tx.client.findUnique({ where: { id: payment.clientId }, select: { membershipEnd: true } })
    // Solo si la membresía actual es la que dejó este pago (si después hubo otro pago, no se toca).
    if (client && sameTime(client.membershipEnd, payment.periodEnd)) {
      if (payment.membershipApplied) {
        await tx.client.update({
          where: { id: payment.clientId },
          data: {
            membershipPlanId: payment.prevMembershipPlanId,
            membershipStart: payment.prevMembershipStart,
            membershipEnd: payment.prevMembershipEnd,
          },
        })
        membershipReverted = true
      } else if (payment.method === "EXTENSION") {
        await tx.client.update({ where: { id: payment.clientId }, data: { membershipEnd: payment.periodStart } })
        membershipReverted = true
      } else {
        // Pagos antiguos sin foto: se vuelve al último pago de membresía que queda.
        const prev = await tx.payment.findFirst({
          where: { clientId: payment.clientId, OR: [{ income: { category: "MEMBERSHIP" } }, { method: "EXTENSION" }] },
          orderBy: { periodEnd: "desc" },
        })
        if (prev) {
          await tx.client.update({
            where: { id: payment.clientId },
            data: { membershipEnd: prev.periodEnd, ...(prev.method === "EXTENSION" ? {} : { membershipStart: prev.periodStart }) },
          })
          membershipReverted = true
        }
      }
    }
  }
  return { deleted: true, membershipReverted }
}

export function deletePayment(paymentId: string) {
  return prisma.$transaction((tx) => deletePaymentTx(tx, paymentId))
}

/** Borra un ingreso de Finanzas y todo lo que depende de él (pago del cliente, membresía, mensualidad de coaching). */
export function deleteIncome(incomeId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { incomeId }, select: { id: true } })
    if (payment) return deletePaymentTx(tx, payment.id)

    // Mensualidad de coaching cobrada: vuelve a quedar pendiente.
    await tx.coachingPayment.updateMany({
      where: { incomeId },
      data: { status: "PENDING", paidAt: null, method: null, incomeId: null, mpPaymentId: null },
    })
    await tx.clientTrainingPlan.updateMany({ where: { incomeId }, data: { incomeId: null } })
    const r = await tx.income.deleteMany({ where: { id: incomeId } })
    return { deleted: r.count > 0, membershipReverted: false }
  })
}
