import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { addDays } from "date-fns"

export async function GET(_req: Request, ctx: RouteContext<"/api/clients/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      membershipPlan: true,
      payments: { orderBy: { paidAt: "desc" } },
      enrollments: { include: { slot: { include: { class: true } } } },
    },
  })
  if (!client) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(client)
}

export async function PUT(request: Request, ctx: RouteContext<"/api/clients/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  const body = await request.json()

  let membershipEnd: Date | undefined
  if (body.membershipPlanId && body.membershipStart) {
    const plan = await prisma.membershipPlan.findUnique({ where: { id: body.membershipPlanId } })
    if (plan) membershipEnd = addDays(new Date(body.membershipStart), plan.durationDays)
  }

  const client = await prisma.client.update({
    where: { id },
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email ?? null,
      phone: body.phone ?? null,
      dni: body.dni ?? null,
      notes: body.notes ?? null,
      membershipPlanId: body.membershipPlanId ?? null,
      membershipStart: body.membershipStart ? new Date(body.membershipStart) : null,
      membershipEnd: membershipEnd ?? undefined,
    },
    include: { membershipPlan: true },
  })
  return NextResponse.json(client)
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/clients/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  await prisma.client.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
