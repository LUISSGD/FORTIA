import { requireNutritionist } from "@/lib/coaching/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import NutritionClientsSearch from "./NutritionClientsSearch"

export const dynamic = "force-dynamic"

export default async function NutritionClientsPage() {
  const guard = await requireNutritionist()
  if ("error" in guard) redirect("/login")

  const profiles = await prisma.coachingProfile.findMany({
    where: { status: { in: ["ACTIVE", "PAUSED"] } },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mealPlans: { where: { isActive: true }, select: { id: true, name: true }, take: 1 },
          coachMessages: {
            where: { channel: "NUTRITION" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, createdAt: true, sender: true, readAt: true },
          },
          coachingBookings: {
            where: { slot: { type: "NUTRITION", startsAt: { gte: new Date() } }, status: "BOOKED" },
            orderBy: { slot: { startsAt: "asc" } },
            take: 1,
            include: { slot: { select: { startsAt: true } } },
          },
        },
      },
    },
    orderBy: { client: { firstName: "asc" } },
  })

  const rows = profiles.map((p) => {
    const lm = p.client.coachMessages[0]
    return {
      id: p.client.id,
      firstName: p.client.firstName,
      lastName: p.client.lastName,
      status: p.status,
      goal: p.goal,
      activePlan: p.client.mealPlans[0] ?? null,
      lastMessage: lm ? { body: lm.body, sender: lm.sender, readAt: lm.readAt ? lm.readAt.toISOString() : null } : null,
      nextAppointment: p.client.coachingBookings[0]?.slot.startsAt?.toISOString() ?? null,
    }
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Clientes ({rows.length})</h1>
      <NutritionClientsSearch rows={rows} />
    </div>
  )
}
