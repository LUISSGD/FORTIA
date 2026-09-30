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

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      coachingProfile: { select: { goal: true, status: true, calTarget: true, proteinTarget: true, carbsTarget: true, fatTarget: true, waterTargetMl: true } },
      nutritionClients: {
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  })

  if (!client) notFound()

  // Ensure a NutritionClient record exists for this client
  let nutritionClient = client.nutritionClients[0] ?? null
  if (!nutritionClient) {
    nutritionClient = await prisma.nutritionClient.create({
      data: {
        clientId: id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email ?? undefined,
        currentGoal: client.coachingProfile?.goal ?? undefined,
      },
    })
  }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0]

  const [consultations, messages, bookings, mealPlans, mealLogs, physicalRecords, waterLogs] = await Promise.all([
    prisma.nutritionConsultation.findMany({
      where: { nutritionClientId: nutritionClient.id },
      orderBy: { date: "desc" },
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
      select: { id: true, name: true, isActive: true, createdAt: true, calTarget: true, proteinTarget: true, carbsTarget: true, fatTarget: true },
    }),
    prisma.mealLog.findMany({
      where: { clientId: id, date: { gte: sevenDaysAgoStr } },
      orderBy: [{ date: "desc" }, { createdAt: "asc" }],
    }),
    prisma.physicalRecord.findMany({
      where: { clientId: id },
      orderBy: { date: "asc" },
      take: 30,
    }),
    prisma.waterLog.findMany({
      where: { clientId: id, date: { gte: sevenDaysAgoStr } },
      orderBy: { date: "asc" },
    }),
  ])

  return (
    <NutritionClientTabs
      client={{
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        goal: client.coachingProfile?.goal ?? null,
        calTarget: client.coachingProfile?.calTarget ?? null,
        proteinTarget: client.coachingProfile?.proteinTarget ?? null,
        carbsTarget: client.coachingProfile?.carbsTarget ?? null,
        fatTarget: client.coachingProfile?.fatTarget ?? null,
        waterTargetMl: client.coachingProfile?.waterTargetMl ?? 2500,
      }}
      nutritionProfile={{
        id: nutritionClient.id,
        gender: nutritionClient.gender ?? null,
        birthDate: nutritionClient.birthDate?.toISOString() ?? null,
        phone: nutritionClient.phone ?? null,
        email: nutritionClient.email ?? null,
        occupation: nutritionClient.occupation ?? null,
        physicalActivityLevel: nutritionClient.physicalActivityLevel ?? null,
        medicalConditions: nutritionClient.medicalConditions ?? null,
        allergies: nutritionClient.allergies ?? null,
        foodPreferences: nutritionClient.foodPreferences ?? null,
        currentGoal: nutritionClient.currentGoal ?? null,
        referredBy: nutritionClient.referredBy ?? null,
        notes: nutritionClient.notes ?? null,
        isActive: nutritionClient.isActive,
      }}
      consultations={consultations.map((c) => ({
        id: c.id,
        date: c.date.toISOString(),
        consultationNumber: c.consultationNumber,
        weight: c.weight ?? null,
        height: c.height ?? null,
        bodyFat: c.bodyFat ?? null,
        muscleMass: c.muscleMass ?? null,
        visceralFat: c.visceralFat ?? null,
        waist: c.waist ?? null,
        hips: c.hips ?? null,
        arms: c.arms ?? null,
        goal: c.goal ?? null,
        calTarget: c.calTarget ?? null,
        proteinTarget: c.proteinTarget ?? null,
        carbsTarget: c.carbsTarget ?? null,
        fatTarget: c.fatTarget ?? null,
        waterTarget: c.waterTarget ?? null,
        dietPlan: c.dietPlan ?? null,
        supplements: c.supplements ?? null,
        recommendations: c.recommendations ?? null,
        observations: c.observations ?? null,
        nextAppointment: c.nextAppointment?.toISOString() ?? null,
        isPaid: c.isPaid,
        paymentAmount: c.paymentAmount ?? null,
      }))}
      messages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
      bookings={bookings.map((b) => ({ id: b.id, startsAt: b.slot.startsAt.toISOString(), endsAt: b.slot.endsAt.toISOString(), title: b.slot.title, status: b.status }))}
      mealPlans={mealPlans.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))}
      mealLogs={mealLogs.map((l) => ({
        id: l.id, date: l.date, name: l.name, status: l.status,
        kcal: l.kcal, protein: l.protein, carbs: l.carbs, fat: l.fat, note: l.note ?? null,
      }))}
      physicalRecords={physicalRecords.map((r) => ({
        id: r.id, date: r.date.toISOString(),
        weight: r.weight ?? null, bodyFat: r.bodyFat ?? null,
        waist: r.waist ?? null, hips: r.hips ?? null, arms: r.arms ?? null,
      }))}
      waterLogs={waterLogs.map((w) => ({ date: w.date, ml: w.ml }))}
      initialTab={tab}
    />
  )
}
