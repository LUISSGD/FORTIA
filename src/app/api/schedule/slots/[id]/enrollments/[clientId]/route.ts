import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function DELETE(_req: Request, ctx: RouteContext<"/api/schedule/slots/[id]/enrollments/[clientId]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id: slotId, clientId } = await ctx.params
  await prisma.enrollment.delete({ where: { slotId_clientId: { slotId, clientId } } })
  return NextResponse.json({ ok: true })
}
