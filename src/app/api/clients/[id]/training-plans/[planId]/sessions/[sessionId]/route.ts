import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type Ctx = { params: Promise<{ id: string; planId: string; sessionId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { planId, sessionId } = await params
  const body = await req.json()
  const { attended, scheduledDate, notes } = body

  const trainingSession = await prisma.trainingSession.findUnique({ where: { id: sessionId } })
  if (!trainingSession) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })

  const plan = await prisma.clientTrainingPlan.findUnique({ where: { id: planId } })
  if (!plan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })

  // Determine counter delta (only when attended is explicitly provided)
  const attendedProvided = "attended" in body
  const wasAttended = trainingSession.attended === true
  const willAttend = attended === true
  const willMiss = attended === false
  const revert = attended === null

  let sessionsDelta = 0
  if (attendedProvided) {
    if (!wasAttended && willAttend) sessionsDelta = 1         // pending/missed → attended
    else if (wasAttended && (willMiss || revert)) sessionsDelta = -1  // attended → pending/missed
  }

  const totalClases = plan.numPacks * plan.clasesPerPack
  const newSessionsCompleted = Math.max(0, plan.sessionsCompleted + sessionsDelta)

  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: {
      attended: attendedProvided ? attended : undefined,
      completedAt: !attendedProvided ? undefined : willAttend ? new Date() : null,
      scheduledDate: scheduledDate !== undefined
        ? (scheduledDate ? new Date(scheduledDate + "T12:00:00") : null)
        : undefined,
      notes: notes !== undefined ? notes || null : undefined,
    },
  })

  const updatedPlan = await prisma.clientTrainingPlan.update({
    where: { id: planId },
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
