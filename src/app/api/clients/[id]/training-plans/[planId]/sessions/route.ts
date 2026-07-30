import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type Ctx = { params: Promise<{ id: string; planId: string }> }

// Add a rescheduled (extra) session
export async function POST(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { planId } = await params
  const body = await req.json()

  const plan = await prisma.clientTrainingPlan.findUnique({
    where: { id: planId },
    include: { sessions: true },
  })
  if (!plan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })

  const rescheduledCount = plan.sessions.filter((s) => s.isRescheduled).length
  const totalNormal = plan.numPacks * plan.clasesPerPack

  await prisma.trainingSession.create({
    data: {
      planId,
      sessionNumber: totalNormal + rescheduledCount + 1,
      packNumber: plan.numPacks,
      isRescheduled: true,
      scheduledDate: body.scheduledDate ? new Date(body.scheduledDate + "T12:00:00") : null,
      attended: null,
      completedAt: null,
      notes: body.notes || null,
    },
  })

  const updatedPlan = await prisma.clientTrainingPlan.findUnique({
    where: { id: planId },
    include: {
      sessions: { orderBy: [{ isRescheduled: "asc" }, { sessionNumber: "asc" }] },
      scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
  })

  return NextResponse.json(updatedPlan)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { planId } = await params

  const plan = await prisma.clientTrainingPlan.findUnique({ where: { id: planId } })
  if (!plan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })

  // Find last attended session to revert to pending
  const lastAttended = await prisma.trainingSession.findFirst({
    where: { planId, attended: true },
    orderBy: { sessionNumber: "desc" },
  })
  if (!lastAttended) return NextResponse.json({ error: "No hay clases asistidas para deshacer" }, { status: 400 })

  await prisma.trainingSession.update({
    where: { id: lastAttended.id },
    data: { attended: null, completedAt: null },
  })

  const newSessionsCompleted = Math.max(0, plan.sessionsCompleted - 1)

  const updated = await prisma.clientTrainingPlan.update({
    where: { id: planId },
    data: {
      sessionsCompleted: newSessionsCompleted,
      status: plan.status === "COMPLETED" ? "ACTIVE" : plan.status,
    },
    include: {
      sessions: { orderBy: [{ isRescheduled: "asc" }, { sessionNumber: "asc" }] },
      scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
  })

  return NextResponse.json(updated)
}
