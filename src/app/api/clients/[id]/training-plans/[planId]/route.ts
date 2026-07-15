import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type Ctx = { params: Promise<{ id: string; planId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { planId } = await params
  const body = await req.json()

  const data: Record<string, unknown> = {}
  if (body.status !== undefined) data.status = body.status
  if (body.notes !== undefined) data.notes = body.notes
  if (body.pricePaid !== undefined) data.pricePaid = Number(body.pricePaid)

  const plan = await prisma.clientTrainingPlan.update({
    where: { id: planId },
    data,
    include: {
      sessions: { orderBy: { sessionNumber: "asc" } },
      scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
  })
  return NextResponse.json(plan)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { planId } = await params

  const plan = await prisma.clientTrainingPlan.findUnique({ where: { id: planId } })
  if (!plan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })

  // Delete plan (CASCADE removes sessions + scheduleSlots)
  await prisma.clientTrainingPlan.delete({ where: { id: planId } })

  return NextResponse.json({ ok: true })
}
