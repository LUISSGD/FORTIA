import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(request: Request, ctx: RouteContext<"/api/schedule/slots/[id]/enrollments">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id: slotId } = await ctx.params
  const { clientId } = await request.json()

  const enrollment = await prisma.enrollment.create({
    data: { slotId, clientId },
    include: { client: { select: { id: true, firstName: true, lastName: true } } },
  })
  return NextResponse.json(enrollment, { status: 201 })
}
