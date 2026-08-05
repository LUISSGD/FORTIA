import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { addDays } from "date-fns"
import { getTrainingPrice, ENTRENADOR_LABELS, MODALIDAD_LABELS, TARIFA_LABELS, type Entrenador, type Modalidad, type Tarifa, type NumPacks, type ClasesPerPack } from "@/lib/training-pricing"

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await request.json()
  const { clientId, amount, method, concept, receiptUrl, paymentType } = body

  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })

  const now = new Date()

  // ── Entrenamiento Personal ──────────────────────────────────────────────
  if (paymentType === "training") {
    const { entrenador, modalidad, tarifa, numPacks, clasesPerPack } = body as {
      entrenador: Entrenador; modalidad: Modalidad; tarifa: Tarifa
      numPacks: NumPacks; clasesPerPack: ClasesPerPack
    }
    const price = getTrainingPrice(entrenador, modalidad, tarifa, numPacks, clasesPerPack)
    if (!price) return NextResponse.json({ error: "Combinación no válida" }, { status: 400 })

    const description = concept ?? [
      ENTRENADOR_LABELS[entrenador],
      MODALIDAD_LABELS[modalidad],
      TARIFA_LABELS[tarifa],
      `${numPacks} pack${numPacks > 1 ? "s" : ""}`,
      `${clasesPerPack} clases`,
      `— ${client.firstName} ${client.lastName}`,
    ].join(" · ")

    const income = await prisma.income.create({
      data: { amount: Number(amount), category: "PERSONAL_TRAINING", description, clientId, date: now },
    })
    const payment = await prisma.payment.create({
      data: {
        clientId,
        amount: Number(amount),
        method: method ?? "CASH",
        concept: description,
        periodStart: now,
        periodEnd: now,
        incomeId: income.id,
        receiptUrl: receiptUrl ?? null,
      },
    })
    return NextResponse.json({ payment, income }, { status: 201 })
  }

  // ── Membresía ───────────────────────────────────────────────────────────
  const { planId, startDate } = body
  const plan = planId
    ? await prisma.membershipPlan.findUnique({ where: { id: planId } })
    : await prisma.membershipPlan.findUnique({ where: { id: client.membershipPlanId ?? "" } })

  if (!plan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })

  const periodStart = startDate ? new Date(startDate + "T00:00:00") : now
  const periodEnd = addDays(periodStart, plan.durationDays)

  const income = await prisma.income.create({
    data: {
      amount: Number(amount),
      category: "MEMBERSHIP",
      description: concept ?? `Renovación ${plan.name} - ${client.firstName} ${client.lastName}`,
      clientId,
      date: now,
    },
  })
  const payment = await prisma.payment.create({
    data: {
      clientId,
      amount: Number(amount),
      method: method ?? "CASH",
      concept: concept ?? `Renovación ${plan.name}`,
      periodStart,
      periodEnd,
      incomeId: income.id,
      receiptUrl: receiptUrl ?? null,
    },
  })
  await prisma.client.update({
    where: { id: clientId },
    data: { membershipPlanId: plan.id, membershipStart: periodStart, membershipEnd: periodEnd },
  })

  return NextResponse.json({ payment, income }, { status: 201 })
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get("clientId")

  const payments = await prisma.payment.findMany({
    where: clientId ? { clientId } : {},
    orderBy: { paidAt: "desc" },
    include: { client: true },
  })
  return NextResponse.json(payments)
}
