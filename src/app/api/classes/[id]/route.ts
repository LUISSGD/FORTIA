import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function PUT(request: Request, ctx: RouteContext<"/api/classes/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  const body = await request.json()
  const cls = await prisma.class.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description ?? null,
      color: body.color,
      maxCapacity: Number(body.maxCapacity),
    },
  })
  return NextResponse.json(cls)
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/classes/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  await prisma.class.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
