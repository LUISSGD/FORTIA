import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import { addDaysYmd, limaDateTime, todayYmd } from "@/lib/coaching/dates"
import { PageTitle } from "@/components/coaching/app/ui"
import BookingsClient from "@/components/coaching/app/BookingsClient"

export default async function BookingsPage() {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const today = todayYmd()
  const [slots, mine] = await Promise.all([
    prisma.coachingSlot.findMany({
      where: { startsAt: { gte: new Date(), lt: limaDateTime(addDaysYmd(today, 21), "00:00") } },
      include: { bookings: { where: { status: { in: ["BOOKED", "WAITLIST"] } }, select: { clientId: true, status: true, id: true } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.coachingBooking.findMany({
      where: { clientId: ctx.clientId, status: { in: ["BOOKED", "WAITLIST"] }, slot: { startsAt: { gte: new Date() } } },
      include: { slot: true },
      orderBy: { slot: { startsAt: "asc" } },
    }),
  ])
  return (
    <div className="space-y-4">
      <PageTitle title="Reservar sesión" subtitle="Elige el horario que mejor te quede" />
      <BookingsClient
        mine={mine.map((b) => ({ id: b.id, status: b.status, startsAt: b.slot.startsAt.toISOString(), title: b.slot.title, mode: b.slot.mode, location: b.slot.location }))}
        slots={slots.map((s) => {
          const booked = s.bookings.filter((b) => b.status === "BOOKED").length
          const my = s.bookings.find((b) => b.clientId === ctx.clientId)
          return { id: s.id, startsAt: s.startsAt.toISOString(), title: s.title, mode: s.mode, free: Math.max(0, s.capacity - booked), capacity: s.capacity, mine: my?.status ?? null }
        })}
      />
    </div>
  )
}
