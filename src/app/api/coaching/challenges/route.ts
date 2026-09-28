import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError, num, str } from "@/lib/coaching/auth"
import { notifyClient } from "@/lib/coaching/notify"

export async function POST(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const body = await request.json()
  const title = str(body.title)
  const startDate = str(body.startDate)
  const endDate = str(body.endDate)
  if (!title || !startDate || !endDate) return jsonError("Título y fechas obligatorios")
  if (endDate < startDate) return jsonError("La fecha de fin debe ser posterior al inicio")
  const challenge = await prisma.challenge.create({
    data: {
      title,
      description: str(body.description),
      metric: str(body.metric) ?? "WORKOUTS",
      target: Math.max(1, Math.round(num(body.target) ?? 20)),
      startDate,
      endDate,
      showRanking: body.showRanking !== false,
    },
  })
  const profiles = await prisma.coachingProfile.findMany({ where: { status: "ACTIVE" }, select: { clientId: true } })
  for (const p of profiles) await notifyClient(p.clientId, { type: "ACHIEVEMENT", title: `🏆 Nuevo reto: ${title}`, body: challenge.description, link: "/app/challenge" })
  return NextResponse.json(challenge, { status: 201 })
}
