import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startOfMonth, endOfMonth, format } from "date-fns"
import { es } from "date-fns/locale"

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
      membershipPlan: { isNot: null },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      firstName2: true,
      lastName2: true,
      membershipEnd: true,
      membershipPlan: { select: { name: true, price: true } },
      renewalSkips: { where: { yearMonth }, select: { id: true } },
    },
    orderBy: { membershipEnd: "asc" },
  })

  const result = clients.map((c) => ({
    id: c.id,
    name: [c.firstName, c.lastName, c.firstName2, c.lastName2].filter(Boolean).join(" "),
    membershipEnd: c.membershipEnd,
    planName: c.membershipPlan?.name ?? "",
    price: c.membershipPlan?.price ?? 0,
    willSkip: c.renewalSkips.length > 0,
  }))

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
