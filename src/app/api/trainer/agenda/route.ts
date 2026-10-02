import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTrainer } from "@/lib/coaching/auth"
import { addDaysYmd, limaDateTime, weekStartYmd, todayYmd } from "@/lib/coaching/dates"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { error } = await requireTrainer()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const rawWeek = searchParams.get("week") ?? todayYmd()
  const week = weekStartYmd(rawWeek)
  const weekStart = new Date(week + "T00:00:00.000Z")
  const weekEnd = new Date(addDaysYmd(week, 7) + "T00:00:00.000Z")

  const trainingSessions = await prisma.trainingSession.findMany({
    where: { scheduledDate: { gte: weekStart, lt: weekEnd }, plan: { status: { in: ["ACTIVE", "PAUSED"] } } },
    include: {
      plan: {
        select: {
          tipoEntrenador: true,
          modalidad: true,
          scheduleSlots: true,
          client: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { scheduledDate: "asc" },
  })

  const slots = trainingSessions.map((s) => {
    const dateStr = s.scheduledDate!.toISOString().slice(0, 10)
    const jsDay = new Date(dateStr + "T12:00:00Z").getUTCDay()
    const fortiaDay = jsDay === 0 ? 6 : jsDay - 1
    const slot = s.plan.scheduleSlots.find((sl) => sl.dayOfWeek === fortiaDay)
    return {
      sessionId: s.id,
      planId: s.planId,
      sessionNumber: s.sessionNumber,
      scheduledDate: dateStr,
      clientId: s.plan.client.id,
      clientName: `${s.plan.client.firstName} ${s.plan.client.lastName}`,
      startTime: slot?.startTime ?? null,
      endTime: slot?.endTime ?? null,
      attended: s.attended ?? null,
      tipoEntrenador: s.plan.tipoEntrenador,
      modalidad: s.plan.modalidad,
    }
  })

  return NextResponse.json({ week, slots })
}
