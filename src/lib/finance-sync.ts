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
  if (payment.incomeId) {
    // Paquete de entrenamiento personal creado con este pago: si aún no tiene clases asistidas
    // se borra (fue un error); si ya se usó, solo se desvincula.
    const plan = await tx.clientTrainingPlan.findUnique({ where: { incomeId: payment.incomeId }, include: { sessions: { select: { attended: true, completedAt: true } } } })
    if (plan) {
      const used = plan.sessionsCompleted > 0 || plan.sessions.some((x) => x.attended === true || x.completedAt)
      if (used) await tx.clientTrainingPlan.update({ where: { id: plan.id }, data: { incomeId: null } })
      else {
        await tx.trainingSession.deleteMany({ where: { planId: plan.id } })
        await tx.clientTrainingPlan.delete({ where: { id: plan.id } })
      }
    }
    await tx.income.deleteMany({ where: { id: payment.incomeId } })
  }

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

/** Registra en Finanzas (ingreso + pago en la ficha) el cobro de un paquete de entrenamiento personal y lo vincula al paquete. */
export async function recordTrainingPayment(
  tx: Tx,
  p: { clientId: string; planId: string; amount: number; method?: string | null; date?: Date; description: string; currency?: string; receiptUrl?: string | null },
) {
  const date = p.date ?? new Date()
  const income = await tx.income.create({
    data: { amount: p.amount, currency: p.currency ?? "PEN", category: "PERSONAL_TRAINING", description: p.description, clientId: p.clientId, date },
  })
  const payment = await tx.payment.create({
    data: { clientId: p.clientId, amount: p.amount, method: p.method ?? "CASH", concept: p.description, periodStart: date, periodEnd: date, incomeId: income.id, receiptUrl: p.receiptUrl ?? null },
  })
  await tx.clientTrainingPlan.update({ where: { id: p.planId }, data: { incomeId: income.id } })
  return { income, payment }
}

/** Borra un paquete de entrenamiento personal y, si tenía pago vinculado, también el pago y su ingreso. */
export function deleteTrainingPlan(planId: string) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.clientTrainingPlan.findUnique({ where: { id: planId } })
    if (!plan) return { deleted: false, paymentDeleted: false }
    let paymentDeleted = false
    if (plan.incomeId) {
      await tx.clientTrainingPlan.update({ where: { id: planId }, data: { incomeId: null } })
      await tx.payment.deleteMany({ where: { incomeId: plan.incomeId } })
      await tx.income.deleteMany({ where: { id: plan.incomeId } })
      paymentDeleted = true
    }
    await tx.trainingSession.deleteMany({ where: { planId } })
    await tx.clientTrainingPlan.delete({ where: { id: planId } })
    return { deleted: true, paymentDeleted }
  })
}
