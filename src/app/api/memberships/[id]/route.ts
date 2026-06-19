import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(_req: Request, ctx: RouteContext<"/api/memberships/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  const plan = await prisma.membershipPlan.findUnique({ where: { id } })
  if (!plan) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(plan)
}

export async function PUT(request: Request, ctx: RouteContext<"/api/memberships/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  const body = await request.json()
  const plan = await prisma.membershipPlan.update({
    where: { id },
    data: {
      name: body.name,
      durationDays: Number(body.durationDays),
      price: Number(body.price),
      description: body.description ?? null,
    },
  })
  return NextResponse.json(plan)
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/memberships/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  await prisma.membershipPlan.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
