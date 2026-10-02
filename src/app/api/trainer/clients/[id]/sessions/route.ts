import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTrainer } from "@/lib/coaching/auth"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireTrainer()
  if ("error" in guard) return guard.error

  const { id: clientId } = await params
  const { planId, scheduledDate } = await request.json()

  if (!planId || !scheduledDate) {
    return NextResponse.json({ error: "Faltan planId o scheduledDate" }, { status: 400 })
  }

  const plan = await prisma.clientTrainingPlan.findFirst({
    where: { id: planId, clientId, status: { in: ["ACTIVE", "PAUSED"] } },
    include: { sessions: { select: { sessionNumber: true }, orderBy: { sessionNumber: "desc" }, take: 1 } },
  })
  if (!plan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })

  const lastNumber = plan.sessions[0]?.sessionNumber ?? 0
  const session = await prisma.trainingSession.create({
    data: {
      planId,
      sessionNumber: lastNumber + 1,
      packNumber: plan.numPacks,
      scheduledDate: new Date(scheduledDate + "T00:00:00Z"),
      isRescheduled: true,
    },
  })

  return NextResponse.json(session, { status: 201 })
}
