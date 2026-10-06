import { prisma } from "@/lib/prisma"
import { calendarYmd } from "@/lib/calendar"
import { addDaysYmd, limaDateTime, weekStartYmd, todayYmd } from "@/lib/coaching/dates"
import TrainerAgendaClient from "./TrainerAgendaClient"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export const dynamic = "force-dynamic"

export default async function TrainerAgendaPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const week = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? weekStartYmd(sp.week) : weekStartYmd(todayYmd())
  const weekStart = new Date(week + "T00:00:00.000Z")
  const weekEnd = new Date(addDaysYmd(week, 7) + "T00:00:00.000Z")

  const [trainingSessions, coachingSlots] = await Promise.all([
    prisma.trainingSession.findMany({
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
    }),
    prisma.coachingSlot.findMany({
      where: { type: "COACHING", startsAt: { gte: limaDateTime(week, "00:00"), lt: limaDateTime(addDaysYmd(week, 7), "00:00") } },
      include: {
        bookings: {
          orderBy: { createdAt: "asc" },
          include: { client: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { startsAt: "asc" },
    }),
  ])

  const trainingSlots = trainingSessions.map((s) => {
    const dateStr = calendarYmd(s.scheduledDate!)
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

  const coachingSlotsMapped = coachingSlots.map((s) => ({
    id: s.id,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    title: s.title,
    mode: s.mode,
    capacity: s.capacity,
    location: s.location,
    bookings: s.bookings.map((b) => ({
      id: b.id,
      status: b.status,
      clientId: b.client.id,
      name: `${b.client.firstName} ${b.client.lastName}`,
    })),
  }))

  return (
    <div className="p-4 space-y-4">
      <TrainerAgendaClient
        week={week}
        trainingSlots={trainingSlots}
        coachingSlots={coachingSlotsMapped}
      />
    </div>
  )
}
