import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { calendarDate } from "@/lib/calendar"
import { requireTrainer } from "@/lib/coaching/auth"
import { syncMembershipWithTraining } from "@/lib/coaching/personal-training"
import { parseStartTime } from "@/lib/session-time"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireTrainer()
  if ("error" in guard) return guard.error

  const { id: clientId } = await params
  const body = await request.json()
  const { planId, scheduledDate } = body

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
      scheduledDate: calendarDate(scheduledDate),
      startTime: parseStartTime(body.startTime) ?? null,
      isRescheduled: true,
    },
  })
  await syncMembershipWithTraining(planId)

  return NextResponse.json(session, { status: 201 })
}
