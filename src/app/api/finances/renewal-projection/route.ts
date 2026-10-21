import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startOfMonth, endOfMonth, format } from "date-fns"
import { es } from "date-fns/locale"
import { trainingPlanName } from "@/lib/training-pricing"

type Pay = { amount: number; concept: string | null; paidAt: Date; balanceDue: number | null; incomeId: string | null; income: { category: string } | null }

/** Total de un pago, contando los saldos ("Saldo — …") ya pagados y el saldo que aún falta. */
function paymentTotal(p: Pay, all: Pay[]) {
  const saldos = all
    .filter((x) => x !== p && x.paidAt >= p.paidAt && /^Saldo( \(parcial\))? — /.test(x.concept ?? "") && x.concept!.endsWith(p.concept ?? "\u0000"))
    .reduce((s, x) => s + x.amount, 0)
  return Math.round((p.amount + saldos + (p.balanceDue ?? 0)) * 100) / 100
}

function parseYearMonth(month: string | null): { monthStart: Date; monthEnd: Date; yearMonth: string } {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, mm] = month.split("-").map(Number)
    const d = new Date(year, mm - 1, 1)
    return { monthStart: startOfMonth(d), monthEnd: endOfMonth(d), yearMonth: month }
  }
  const now = new Date()
  return {
    monthStart: startOfMonth(now),
    monthEnd: endOfMonth(now),
    yearMonth: format(now, "yyyy-MM"),
  }
}

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month")
  const { monthStart, monthEnd, yearMonth } = parseYearMonth(month)

  const clients = await prisma.client.findMany({
    where: {
      isActive: true,
      membershipEnd: { gte: monthStart, lte: monthEnd },
      // La 2ª persona de una pareja comparte la membresía de la ficha principal: no se cuenta dos veces.
      partnerOfId: null,
      OR: [{ membershipPlan: { isNot: null } }, { trainingPlans: { some: {} } }],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      firstName2: true,
      lastName2: true,
      membershipEnd: true,
      membershipPlan: { select: { name: true, price: true } },
      trainingPlans: {
        orderBy: { createdAt: "desc" }, take: 1,
        select: { createdAt: true, pricePaid: true, incomeId: true, tipoEntrenador: true, modalidad: true, tarifa: true, numPacks: true, clasesPerPack: true },
      },
      payments: {
        where: { method: { not: "EXTENSION" } },
        orderBy: { paidAt: "desc" }, take: 30,
        select: { amount: true, concept: true, paidAt: true, balanceDue: true, incomeId: true, income: { select: { category: true } } },
      },
      renewalSkips: { where: { yearMonth }, select: { id: true } },
    },
    orderBy: { membershipEnd: "asc" },
  })

  // Precio proyectado = lo que pagó la última vez por lo que tiene ahora (paquete EP completo, p. ej. 3 packs,
  // o la última membresía), no el precio de lista del plan. Sin pagos registrados, el precio del plan.
  const result = clients.map((c) => {
    const ep = c.trainingPlans[0] ?? null
    const lastMembership = c.payments.find((p) => p.income?.category === "MEMBERSHIP" && !(p.concept ?? "").startsWith("Saldo"))
    const useEp = !!ep && (!lastMembership || ep.createdAt >= lastMembership.paidAt)
    let price = c.membershipPlan?.price ?? 0
    let planName = c.membershipPlan?.name ?? ""
    let priceSource: "lastPayment" | "plan" = "plan"
    if (useEp) {
      const linked = ep.incomeId ? c.payments.find((p) => p.incomeId === ep.incomeId) : undefined
      price = linked ? paymentTotal(linked, c.payments) : ep.pricePaid
      planName = trainingPlanName(ep)
      priceSource = "lastPayment"
    } else if (lastMembership) {
      price = paymentTotal(lastMembership, c.payments)
      priceSource = "lastPayment"
    }
    return {
      id: c.id,
      name: [c.firstName, c.lastName, c.firstName2, c.lastName2].filter(Boolean).join(" "),
      membershipEnd: c.membershipEnd,
      planName,
      price,
      priceSource,
      willSkip: c.renewalSkips.length > 0,
    }
  })

  const projectedTotal = result.filter((c) => !c.willSkip).reduce((s, c) => s + c.price, 0)
  const skippedTotal = result.filter((c) => c.willSkip).reduce((s, c) => s + c.price, 0)

  const [y, m] = yearMonth.split("-")
  const monthLabel = format(new Date(Number(y), Number(m) - 1, 1), "MMMM yyyy", { locale: es })

  return NextResponse.json({ clients: result, projectedTotal, skippedTotal, monthLabel, yearMonth })
}

export async function POST(req: NextRequest) {
  const { clientId, yearMonth, skip } = await req.json() as {
    clientId: string
    yearMonth: string
    skip: boolean
  }

  if (!clientId || !yearMonth) {
    return NextResponse.json({ error: "clientId y yearMonth requeridos" }, { status: 400 })
  }

  if (skip) {
    await prisma.renewalProjectionSkip.upsert({
      where: { clientId_yearMonth: { clientId, yearMonth } },
      create: { clientId, yearMonth },
      update: {},
    })
  } else {
    await prisma.renewalProjectionSkip.deleteMany({ where: { clientId, yearMonth } })
  }

  return NextResponse.json({ ok: true })
}
