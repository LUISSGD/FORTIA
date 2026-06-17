import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { addDays } from "date-fns"

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await request.json()
  const { clientId, planId, amount, method, concept } = body

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { membershipPlan: true },
  })
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })

  const plan = planId
    ? await prisma.membershipPlan.findUnique({ where: { id: planId } })
    : client.membershipPlan

  if (!plan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })

  const now = new Date()
  const periodStart = now
  const currentEnd = client.membershipEnd ? new Date(client.membershipEnd) : now
  const baseDate = currentEnd > now ? currentEnd : now
  const periodEnd = addDays(baseDate, plan.durationDays)

  // Create income record
  const income = await prisma.income.create({
    data: {
      amount: Number(amount),
      category: "MEMBERSHIP",
      description: concept ?? `Renovación ${plan.name} - ${client.firstName} ${client.lastName}`,
      clientId,
      date: now,
    },
  })

  // Create payment and link to income
  const payment = await prisma.payment.create({
    data: {
      clientId,
      amount: Number(amount),
      method: method ?? "CASH",
      concept: concept ?? `Renovación ${plan.name}`,
      periodStart,
      periodEnd,
      incomeId: income.id,
    },
  })

  // Update client membership
  await prisma.client.update({
    where: { id: clientId },
    data: {
      membershipPlanId: plan.id,
      membershipStart: periodStart,
      membershipEnd: periodEnd,
    },
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
