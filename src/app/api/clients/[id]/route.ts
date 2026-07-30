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

  try {
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
        trainer: body.trainer || null,
        membershipPlanId: body.membershipPlanId || null,
        membershipStart: body.membershipStart ? new Date(body.membershipStart + "T00:00:00") : undefined,
        membershipEnd: body.membershipEnd ? new Date(body.membershipEnd + "T00:00:00") : undefined,
      },
      include: { membershipPlan: true },
    })
    return NextResponse.json(client)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("Unique constraint") && msg.includes("dni2")) {
      return NextResponse.json({ error: "El DNI de la persona 2 ya está registrado en otro cliente" }, { status: 409 })
    }
    if (msg.includes("Unique constraint") && msg.includes("dni")) {
      return NextResponse.json({ error: "El DNI principal ya está registrado en otro cliente" }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/clients/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  await prisma.client.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
