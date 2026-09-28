import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError, num, str } from "@/lib/coaching/auth"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id: clientId } = await params
  const body = await request.json()
  const title = str(body.title)
  if (!title) return jsonError("Título obligatorio")
  const goal = await prisma.coachingGoal.create({
    data: {
      clientId,
      title,
      metric: str(body.metric) ?? "CUSTOM",
      startValue: num(body.startValue),
      targetValue: num(body.targetValue),
      unit: str(body.unit),
      dueDate: body.dueDate ? new Date(`${body.dueDate}T12:00:00Z`) : null,
    },
  })
  return NextResponse.json(goal, { status: 201 })
}
