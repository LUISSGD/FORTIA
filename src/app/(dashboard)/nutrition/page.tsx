import { prisma } from "@/lib/prisma"
import Header from "@/components/layout/Header"
import NutritionListClient from "./NutritionListClient"

export const dynamic = "force-dynamic"

export default async function NutritionPage() {
  const clients = await prisma.nutritionClient.findMany({
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
    include: {
      consultations: {
        orderBy: { date: "desc" },
        take: 1,
        select: {
          id: true,
          date: true,
          weight: true,
          nextAppointment: true,
          isPaid: true,
          goal: true,
          consultationNumber: true,
        },
      },
    },
  })

  const now = new Date()
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const totalActive = clients.filter((c) => c.isActive).length
  const consultationsThisMonth = await prisma.nutritionConsultation.count({
    where: {
      date: {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lte: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      },
    },
  })
  const upcomingAppointments = clients.filter(
    (c) =>
      c.consultations[0]?.nextAppointment &&
      new Date(c.consultations[0].nextAppointment) >= now &&
      new Date(c.consultations[0].nextAppointment) <= sevenDays
  ).length
  const pendingPayments = clients.filter(
    (c) => c.consultations[0] && !c.consultations[0].isPaid
  ).length

  const serialized = clients.map((c) => ({
    ...c,
    birthDate: c.birthDate?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    consultations: c.consultations.map((con) => ({
      ...con,
      date: con.date.toISOString(),
      nextAppointment: con.nextAppointment?.toISOString() ?? null,
    })),
  }))

  return (
    <>
      <Header title="Nutrición" />
      <NutritionListClient
        clients={serialized}
        stats={{ totalActive, consultationsThisMonth, upcomingAppointments, pendingPayments }}
      />
    </>
  )
}
