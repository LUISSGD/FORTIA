import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { calendarDate, calendarYmd } from "@/lib/calendar"
import { getRenewalProjection } from "@/lib/finance/renewals"

// Plan del mes: caja, obligaciones priorizadas (con fecha límite) y ventas extra de un mes ("2026-10").

const YM = /^\d{4}-(0[1-9]|1[0-2])$/
const YMD = /^\d{4}-\d{2}-\d{2}$/
const money = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100
const thisMonth = () => calendarYmd(new Date()).slice(0, 7)
function monthEnd(ym: string) {
  const [y, m] = ym.split("-").map(Number)
  return new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10)
}

async function ensurePlan(yearMonth: string) {
  return prisma.cashPlan.upsert({ where: { yearMonth }, create: { yearMonth }, update: {} })
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const q = new URL(request.url).searchParams.get("month") ?? ""
  const yearMonth = YM.test(q) ? q : thisMonth()
  const [y, m] = yearMonth.split("-").map(Number)

  const [plan, pending, products, projection] = await Promise.all([
    prisma.cashPlan.findUnique({
      where: { yearMonth },
      include: {
        items: { orderBy: { priority: "asc" }, include: { expense: true } },
        sales: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      },
    }),
    // Lo que se puede agregar: obligaciones pendientes hasta este mes (las atrasadas primero)
    prisma.monthlyExpense.findMany({
      where: { status: { not: "PAGADO" }, amount: { gt: 0 }, OR: [{ year: { lt: y } }, { year: y, month: { lte: m } }] },
      orderBy: [{ year: "asc" }, { month: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.membershipPlan.findMany({ where: { isActive: true }, select: { id: true, name: true, price: true }, orderBy: { name: "asc" } }),
    getRenewalProjection(yearMonth),
  ])

  const inPlan = new Set(plan?.items.map((i) => i.expenseId) ?? [])
  return NextResponse.json({
    yearMonth,
    today: calendarYmd(new Date()),
    monthEnd: monthEnd(yearMonth),
    plan: plan
      ? {
          bankPen: plan.bankPen, bankUsd: plan.bankUsd, exchangeRate: plan.exchangeRate, bankUpdatedAt: plan.bankUpdatedAt, notes: plan.notes,
          items: plan.items.map((i) => ({
            id: i.id, expenseId: i.expenseId, priority: i.priority, payBy: calendarYmd(i.payBy),
            concept: i.expense.concept, category: i.expense.category, month: i.expense.month, year: i.expense.year,
            amount: i.expense.amount, currency: i.expense.currency, status: i.expense.status,
          })),
          sales: plan.sales.map((s) => ({ id: s.id, label: s.label, membershipPlanId: s.membershipPlanId, unitPrice: s.unitPrice, quantity: s.quantity, expectedOn: s.expectedOn ? calendarYmd(s.expectedOn) : null })),
        }
      : { bankPen: 0, bankUsd: 0, exchangeRate: 3.45, bankUpdatedAt: null, notes: null, items: [], sales: [] },
    candidates: pending.filter((e) => !inPlan.has(e.id)).map((e) => ({ id: e.id, concept: e.concept, category: e.category, month: e.month, year: e.year, amount: e.amount, currency: e.currency })),
    products,
    renewals: projection.clients.map((c) => ({ name: c.name, end: c.membershipEnd ? calendarYmd(c.membershipEnd) : null, price: c.price, willSkip: c.willSkip })),
  })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const yearMonth = typeof body.month === "string" && YM.test(body.month) ? body.month : null
  if (!yearMonth) return NextResponse.json({ error: "Mes no válido" }, { status: 400 })
  const plan = await ensurePlan(yearMonth)
  const end = monthEnd(yearMonth)
  const day = (v: unknown, fallback: string) => calendarDate(typeof v === "string" && YMD.test(v) ? v : fallback)

  switch (body.action) {
    case "setBank": {
      const rate = Number(body.exchangeRate)
      await prisma.cashPlan.update({
        where: { id: plan.id },
        data: { bankPen: money(body.bankPen), bankUsd: money(body.bankUsd), exchangeRate: rate > 0 ? rate : 3.45, bankUpdatedAt: new Date(), notes: typeof body.notes === "string" ? body.notes.trim() || null : undefined },
      })
      return NextResponse.json({ ok: true })
    }

    // Agrega obligaciones al final de la lista de prioridades (fecha límite: la indicada o fin de mes)
    case "addItems": {
      const ids = (Array.isArray(body.expenseIds) ? body.expenseIds : []).filter((x: unknown): x is string => typeof x === "string")
      if (!ids.length) return NextResponse.json({ error: "Elige al menos una obligación" }, { status: 400 })
      const max = await prisma.cashPlanItem.aggregate({ where: { planId: plan.id }, _max: { priority: true } })
      let p = (max._max.priority ?? 0) + 1
      const payBy = day(body.payBy, end)
      const r = await prisma.cashPlanItem.createMany({
        data: ids.map((expenseId: string) => ({ planId: plan.id, expenseId, payBy, priority: p++ })),
        skipDuplicates: true,
      })
      return NextResponse.json({ added: r.count })
    }

    case "updateItem": {
      if (typeof body.id !== "string") return NextResponse.json({ error: "Falta el pago" }, { status: 400 })
      await prisma.cashPlanItem.update({ where: { id: body.id, planId: plan.id }, data: { payBy: day(body.payBy, end) } })
      return NextResponse.json({ ok: true })
    }

    case "removeItem": {
      await prisma.cashPlanItem.deleteMany({ where: { id: String(body.id), planId: plan.id } })
      return NextResponse.json({ ok: true })
    }

    // Nuevo orden de prioridades (ids de arriba a abajo)
    case "reorder": {
      const ids = (Array.isArray(body.ids) ? body.ids : []).filter((x: unknown): x is string => typeof x === "string")
      await prisma.$transaction(ids.map((id: string, i: number) => prisma.cashPlanItem.updateMany({ where: { id, planId: plan.id }, data: { priority: i + 1 } })))
      return NextResponse.json({ ok: true })
    }

    case "addSale":
    case "updateSale": {
      const label = typeof body.label === "string" ? body.label.trim() : ""
      if (!label) return NextResponse.json({ error: "Indica qué vas a vender" }, { status: 400 })
      const data = {
        label,
        membershipPlanId: typeof body.membershipPlanId === "string" && body.membershipPlanId ? body.membershipPlanId : null,
        unitPrice: money(body.unitPrice),
        quantity: Math.max(0, Math.round(Number(body.quantity) || 0)),
        expectedOn: typeof body.expectedOn === "string" && YMD.test(body.expectedOn) ? calendarDate(body.expectedOn) : null,
      }
      if (body.action === "addSale") {
        const count = await prisma.cashPlanSale.count({ where: { planId: plan.id } })
        await prisma.cashPlanSale.create({ data: { ...data, planId: plan.id, sortOrder: count } })
      } else {
        await prisma.cashPlanSale.update({ where: { id: String(body.id), planId: plan.id }, data })
      }
      return NextResponse.json({ ok: true })
    }

    case "removeSale": {
      await prisma.cashPlanSale.deleteMany({ where: { id: String(body.id), planId: plan.id } })
      return NextResponse.json({ ok: true })
    }
  }
  return NextResponse.json({ error: "Acción no válida" }, { status: 400 })
}
