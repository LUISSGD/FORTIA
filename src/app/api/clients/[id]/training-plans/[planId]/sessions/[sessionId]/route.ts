import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { syncMembershipWithTraining } from "@/lib/coaching/personal-training"
import { calendarDate, calendarYmd } from "@/lib/calendar"
import { parseStartTime, reprogramNotes, sessionTime } from "@/lib/session-time"
import { auth } from "@/lib/auth"

type Ctx = { params: Promise<{ id: string; planId: string; sessionId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { planId, sessionId } = await params
  const body = await req.json()
  const { attended, scheduledDate, notes } = body
  const startTime = parseStartTime(body.startTime)
  if (body.startTime !== undefined && startTime === undefined) return NextResponse.json({ error: "Hora no válida" }, { status: 400 })

  const trainingSession = await prisma.trainingSession.findUnique({ where: { id: sessionId } })
  if (!trainingSession) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })

  const plan = await prisma.clientTrainingPlan.findUnique({ where: { id: planId }, include: { scheduleSlots: true } })
  if (!plan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })

  // Determine counter delta (only when attended is explicitly provided)
  // Reprogramó: se mueve la clase (queda pendiente) y se anota la fecha de la que venía
  const reprogram = body.reprogram === true
  if (reprogram && !scheduledDate) return NextResponse.json({ error: "Indica la nueva fecha" }, { status: 400 })
  const oldYmd = trainingSession.scheduledDate ? calendarYmd(trainingSession.scheduledDate) : null
  const newNotes = reprogram
    ? reprogramNotes(trainingSession.notes, oldYmd, sessionTime({ startTime: trainingSession.startTime, scheduledYmd: oldYmd }, plan.scheduleSlots))
    : notes !== undefined ? notes || null : undefined

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
        ? (scheduledDate ? calendarDate(scheduledDate) : null)
        : undefined,
      notes: newNotes,
      startTime,
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

  // Si se movió la fecha de una clase, el vencimiento de la membresía sigue a la última clase
  if (scheduledDate !== undefined) await syncMembershipWithTraining(planId)

  return NextResponse.json(updatedPlan)
}
