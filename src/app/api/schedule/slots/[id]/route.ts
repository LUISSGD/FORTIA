import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function PUT(request: Request, ctx: RouteContext<"/api/schedule/slots/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  const body = await request.json()
  const slot = await prisma.scheduleSlot.update({
    where: { id },
    data: {
      startTime: body.startTime,
      endTime: body.endTime,
      instructor: body.instructor || null,
      room: body.room || null,
    },
    include: { class: true },
  })
  return NextResponse.json(slot)
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/schedule/slots/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  await prisma.enrollment.deleteMany({ where: { slotId: id } })
  await prisma.scheduleSlot.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
