import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
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

  const client = await prisma.client.update({
    where: { id },
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone || null,
      dni: body.dni || null,
      firstName2: body.firstName2 || null,
      lastName2: body.lastName2 || null,
      phone2: body.phone2 || null,
      dni2: body.dni2 || null,
      notes: body.notes || null,
      membershipPlanId: body.membershipPlanId || null,
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
