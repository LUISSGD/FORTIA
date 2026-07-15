import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(request: Request, ctx: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await ctx.params
  const body = await request.json()

  const item = await prisma.monthlyExpense.update({
    where: { id },
    data: {
      concept: body.concept,
      currency: body.currency,
      amount: Number(body.amount),
      status: body.status,
      notes: body.notes || null,
      paidAt: body.status === "PAGADO" ? new Date() : null,
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await ctx.params
  await prisma.monthlyExpense.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
