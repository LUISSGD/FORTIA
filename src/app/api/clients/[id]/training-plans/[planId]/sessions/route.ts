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
    include: { sessions: true, scheduleSlots: true },
  })
  if (!plan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })

  const rescheduledCount = plan.sessions.filter((s) => s.isRescheduled).length
  const totalNormal = plan.numPacks * plan.clasesPerPack

  // Auto-assign next recurring date if no date provided
  let scheduledDate: Date | null = body.scheduledDate ? new Date(body.scheduledDate + "T12:00:00") : null
  if (!scheduledDate && plan.scheduleSlots.length > 0) {
    const lastWithDate = plan.sessions
      .filter((s) => s.scheduledDate)
      .sort((a, b) => new Date(b.scheduledDate!).getTime() - new Date(a.scheduledDate!).getTime())[0]
    const cursor = lastWithDate?.scheduledDate ? new Date(lastWithDate.scheduledDate) : new Date()
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    const sorted = [...plan.scheduleSlots].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    for (let i = 0; i < 14; i++) {
      const jsDay = cursor.getUTCDay()
      const fortiaDay = jsDay === 0 ? 6 : jsDay - 1
      if (sorted.some((s) => s.dayOfWeek === fortiaDay)) {
        scheduledDate = new Date(cursor)
        scheduledDate.setUTCHours(12, 0, 0, 0)
        break
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }

  await prisma.trainingSession.create({
    data: {
      planId,
      sessionNumber: totalNormal + rescheduledCount + 1,
      packNumber: plan.numPacks,
      isRescheduled: true,
      scheduledDate,
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
