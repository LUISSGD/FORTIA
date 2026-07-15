import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type Ctx = { params: Promise<{ id: string; planId: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { planId } = await params
  const body = await req.json()

  const plan = await prisma.clientTrainingPlan.findUnique({ where: { id: planId } })
  if (!plan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })
  if (plan.status !== "ACTIVE") return NextResponse.json({ error: "Plan no activo" }, { status: 400 })

  const totalClases = plan.numPacks * plan.clasesPerPack
  if (plan.sessionsCompleted >= totalClases) {
    return NextResponse.json({ error: "Plan ya completado" }, { status: 400 })
  }

  const newSessionsCompleted = plan.sessionsCompleted + 1
  const currentPack = Math.floor(plan.sessionsCompleted / plan.clasesPerPack) + 1
  const newPack = Math.floor(newSessionsCompleted / plan.clasesPerPack) + 1
  const isCompleted = newSessionsCompleted >= totalClases
  const packAdvanced = !isCompleted && newPack > currentPack

  await prisma.trainingSession.create({
    data: {
      planId,
      sessionNumber: newSessionsCompleted,
      packNumber: currentPack,
      notes: body.notes || null,
    },
  })

  const updated = await prisma.clientTrainingPlan.update({
    where: { id: planId },
    data: {
      sessionsCompleted: newSessionsCompleted,
      status: isCompleted ? "COMPLETED" : "ACTIVE",
      currentPackStart: packAdvanced ? new Date() : undefined,
    },
    include: { sessions: { orderBy: { sessionNumber: "asc" } } },
  })

  return NextResponse.json(updated)
}
