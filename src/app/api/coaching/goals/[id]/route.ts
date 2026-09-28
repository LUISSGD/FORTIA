import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach } from "@/lib/coaching/auth"
import { notifyClient } from "@/lib/coaching/notify"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const body = await request.json()
  const goal = await prisma.coachingGoal.update({
    where: { id },
    data: { achievedAt: body.achieved ? new Date() : null },
  })
  if (body.achieved) {
    await notifyClient(goal.clientId, { type: "ACHIEVEMENT", title: "🎯 ¡Objetivo cumplido!", body: goal.title, link: "/app/progress" })
  }
  return NextResponse.json(goal)
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  await prisma.coachingGoal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
