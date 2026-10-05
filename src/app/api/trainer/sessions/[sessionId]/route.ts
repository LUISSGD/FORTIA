import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTrainer } from "@/lib/coaching/auth"

type Ctx = { params: Promise<{ sessionId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { error } = await requireTrainer()
  if (error) return error

  const { sessionId } = await params
  const body = await req.json()
  const { attended, scheduledDate } = body

  const trainingSession = await prisma.trainingSession.findUnique({ where: { id: sessionId } })
  if (!trainingSession) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })

  const plan = await prisma.clientTrainingPlan.findUnique({ where: { id: trainingSession.planId } })
  if (!plan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })

  const attendedProvided = "attended" in body
  const wasAttended = trainingSession.attended === true
  const willAttend = attended === true
  const willMiss = attended === false
  const revert = attended === null

  let sessionsDelta = 0
  if (attendedProvided) {
    if (!wasAttended && willAttend) sessionsDelta = 1
    else if (wasAttended && (willMiss || revert)) sessionsDelta = -1
  }

  const totalClases = plan.numPacks * plan.clasesPerPack
  const newSessionsCompleted = Math.max(0, plan.sessionsCompleted + sessionsDelta)

  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: {
      attended: attendedProvided ? attended : undefined,
      completedAt: !attendedProvided ? undefined : willAttend ? new Date() : null,
      scheduledDate: scheduledDate !== undefined
        ? (scheduledDate ? new Date(scheduledDate + "T12:00:00Z") : null)
        : undefined,
    },
  })

  const updatedPlan = await prisma.clientTrainingPlan.update({
    where: { id: plan.id },
    data: {
      sessionsCompleted: newSessionsCompleted,
      status: newSessionsCompleted >= totalClases ? "COMPLETED"
        : plan.status === "COMPLETED" ? "ACTIVE"
        : plan.status,
    },
    include: {
      sessions: { orderBy: [{ isRescheduled: "asc" }, { sessionNumber: "asc" }] },
      scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
  })

  return NextResponse.json(updatedPlan)
}
