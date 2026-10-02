import { prisma } from "@/lib/prisma"
import { addDaysYmd, weekStartYmd, todayYmd } from "@/lib/coaching/dates"
import TrainerAgendaClient from "./TrainerAgendaClient"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export const dynamic = "force-dynamic"

export default async function TrainerAgendaPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const week = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? weekStartYmd(sp.week) : weekStartYmd(todayYmd())
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

  const trainingSlots = trainingSessions.map((s) => {
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
      attended: s.attended ?? null,
    }
  })

  return <TrainerAgendaClient week={week} trainingSlots={trainingSlots} />
}
