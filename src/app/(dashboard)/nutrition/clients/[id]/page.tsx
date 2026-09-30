import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireNutritionist } from "@/lib/coaching/auth"
import NutritionClientTabs from "./NutritionClientTabs"

export const dynamic = "force-dynamic"

export default async function NutritionClientPage({ params, searchParams }: PageProps<"/nutrition/clients/[id]">) {
  const guard = await requireNutritionist()
  if ("error" in guard) redirect("/login")

  const { id } = await params
  const sp = await searchParams
  const tab = (sp?.tab as string) ?? "plan"

  const [client, messages, bookings, mealPlans] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: {
        coachingProfile: { select: { goal: true, status: true, calTarget: true, proteinTarget: true } },
        nutritionClients: {
          include: {
            consultations: { orderBy: { date: "desc" }, take: 10 },
          },
          take: 1,
        },
      },
    }),
    prisma.coachMessage.findMany({ where: { clientId: id, channel: "NUTRITION" }, orderBy: { createdAt: "asc" }, take: 300 }),
    prisma.coachingBooking.findMany({
      where: { clientId: id, slot: { type: "NUTRITION" }, status: "BOOKED" },
      include: { slot: true },
      orderBy: { slot: { startsAt: "asc" } },
    }),
    prisma.mealPlan.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, isActive: true, createdAt: true },
    }),
  ])

  if (!client) notFound()

  const consultations = (client.nutritionClients[0]?.consultations ?? []).map((c) => ({
    id: c.id,
    date: c.date.toISOString(),
    notes: (c as { notes?: string | null }).notes ?? "",
    weight: c.weight ?? null,
  }))

  return (
    <NutritionClientTabs
      client={{
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        goal: client.coachingProfile?.goal ?? null,
        calTarget: client.coachingProfile?.calTarget ?? null,
        proteinTarget: client.coachingProfile?.proteinTarget ?? null,
        consultations,
      }}
      messages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
      bookings={bookings.map((b) => ({ id: b.id, startsAt: b.slot.startsAt, endsAt: b.slot.endsAt, title: b.slot.title, status: b.status }))}
      mealPlans={mealPlans.map((p) => ({ id: p.id, name: p.name, isActive: p.isActive, createdAt: p.createdAt }))}
      initialTab={tab}
    />
  )
}
