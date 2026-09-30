import { requireNutritionist } from "@/lib/coaching/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import NutritionAgendaClient from "./NutritionAgendaClient"

export const dynamic = "force-dynamic"

export default async function NutritionAgendaPage() {
  const guard = await requireNutritionist()
  if ("error" in guard) redirect("/login")

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - 7)
  const weekEnd = new Date(now)
  weekEnd.setDate(now.getDate() + 21)

  const [slots, clients] = await Promise.all([
    prisma.coachingSlot.findMany({
      where: { type: "NUTRITION", startsAt: { gte: weekStart, lte: weekEnd } },
      include: {
        bookings: {
          where: { status: "BOOKED" },
          include: { client: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.coachingProfile.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED"] } },
      select: { client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { client: { firstName: "asc" } },
    }),
  ])

  return (
    <NutritionAgendaClient
      slots={slots.map((s) => ({
        id: s.id,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        title: s.title,
        mode: s.mode,
        location: s.location ?? "",
        bookings: s.bookings.map((b) => ({
          id: b.id,
          clientId: b.clientId,
          clientName: `${b.client.firstName} ${b.client.lastName}`,
        })),
      }))}
      clients={clients.map((p) => ({ id: p.client.id, name: `${p.client.firstName} ${p.client.lastName}` }))}
    />
  )
}
