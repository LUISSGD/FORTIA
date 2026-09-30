import { requireNutritionist } from "@/lib/coaching/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import NutritionMessagesClient from "./NutritionMessagesClient"

export const dynamic = "force-dynamic"

export default async function NutritionMessagesPage() {
  const guard = await requireNutritionist()
  if ("error" in guard) redirect("/login")

  const lastByClient = await prisma.coachMessage.findMany({
    where: { channel: "NUTRITION" },
    distinct: ["clientId"],
    orderBy: { createdAt: "desc" },
    include: { client: { select: { id: true, firstName: true, lastName: true } } },
    take: 100,
  })

  return (
    <NutritionMessagesClient
      threads={lastByClient.map((m) => ({
        clientId: m.clientId,
        clientName: `${m.client.firstName} ${m.client.lastName}`,
        lastName: m.client.lastName,
        lastBody: m.body,
        lastAt: m.createdAt,
        unread: !m.readAt && m.sender === "CLIENT",
      }))}
    />
  )
}
