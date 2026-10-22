import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { planTrainer, syncMembershipWithTraining } from "@/lib/coaching/personal-training"
import { calendarDate, calendarYmd } from "@/lib/calendar"
import { parseStartTime, reprogramNotes, sessionTime } from "@/lib/session-time"
import { requireTrainer } from "@/lib/coaching/auth"

type Ctx = { params: Promise<{ sessionId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { error } = await requireTrainer()
  if (error) return error

  const { sessionId } = await params
  const body = await req.json()
  const { attended, scheduledDate } = body
  const startTime = parseStartTime(body.startTime)
  if (body.startTime !== undefined && startTime === undefined) return NextResponse.json({ error: "Hora no válida" }, { status: 400 })

  const trainingSession = await prisma.trainingSession.findUnique({ where: { id: sessionId } })
  if (!trainingSession) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })

  const plan = await prisma.clientTrainingPlan.findUnique({ where: { id: trainingSession.planId }, include: { scheduleSlots: true } })
  if (!plan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })

  // Reprogramó: se mueve la clase (queda pendiente) y se anota la fecha de la que venía
  const reprogram = body.reprogram === true
  if (reprogram && !scheduledDate) return NextResponse.json({ error: "Indica la nueva fecha" }, { status: 400 })
  const oldYmd = trainingSession.scheduledDate ? calendarYmd(trainingSession.scheduledDate) : null
  const newNotes = reprogram
    ? reprogramNotes(trainingSession.notes, oldYmd, sessionTime({ startTime: trainingSession.startTime, scheduledYmd: oldYmd }, plan.scheduleSlots))
    : undefined

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
      // Quién dio la clase (para comisiones): el entrenador asignado al marcarla
      trainer: !attendedProvided ? undefined : attended === null ? null : await planTrainer(plan.id),
      completedAt: !attendedProvided ? undefined : willAttend ? new Date() : null,
      scheduledDate: scheduledDate !== undefined
        ? (scheduledDate ? calendarDate(scheduledDate) : null)
        : undefined,
      startTime,
      notes: newNotes,
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

  // Si se movió la fecha de una clase, el vencimiento de la membresía sigue a la última clase
  if (scheduledDate !== undefined) await syncMembershipWithTraining(plan.id)

  return NextResponse.json(updatedPlan)
}
