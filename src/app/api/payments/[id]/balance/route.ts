import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { calendarDate, calendarYmd } from "@/lib/calendar"

type Ctx = { params: Promise<{ id: string }> }

/**
 * Registra el pago (total o parcial) del saldo pendiente de un pago: crea su ingreso en Finanzas
 * (misma categoría que el pago original) y un pago nuevo en el historial. Si paga menos, queda el resto.
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const original = await prisma.payment.findUnique({ where: { id }, include: { income: { select: { category: true, currency: true } } } })
  if (!original) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })
  if (!original.balanceDue || original.balancePaidAt) return NextResponse.json({ error: "Este pago no tiene saldo pendiente" }, { status: 400 })

  const amount = Math.round(Number(body.amount) * 100) / 100
  if (!(amount > 0)) return NextResponse.json({ error: "Indica el monto" }, { status: 400 })
  if (amount > original.balanceDue + 0.01) return NextResponse.json({ error: `El saldo pendiente es S/ ${original.balanceDue}` }, { status: 400 })
  const day = calendarDate(typeof body.paidAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.paidAt) ? body.paidAt : calendarYmd(new Date()))
  const remaining = Math.round((original.balanceDue - amount) * 100) / 100
  const concept = `Saldo${remaining > 0 ? " (parcial)" : ""} — ${original.concept ?? "pago"}`

  const result = await prisma.$transaction(async (tx) => {
    const income = await tx.income.create({
      data: {
        amount, currency: original.income?.currency ?? "PEN", category: original.income?.category ?? "MEMBERSHIP",
        description: concept, clientId: original.clientId, date: day,
      },
    })
    const payment = await tx.payment.create({
      data: {
        clientId: original.clientId, amount, method: typeof body.method === "string" ? body.method : "CASH", concept,
        paidAt: day, periodStart: day, periodEnd: day, incomeId: income.id,
      },
    })
    await tx.payment.update({
      where: { id },
      data: remaining > 0 ? { balanceDue: remaining } : { balancePaidAt: new Date() },
    })
    return { payment, remaining }
  })
  return NextResponse.json(result, { status: 201 })
}
