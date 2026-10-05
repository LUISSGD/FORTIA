import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import ChatPanel from "@/components/coaching/ChatPanel"
import ChatScreen from "@/components/coaching/app/ChatScreen"

export default async function NutritionChatPage() {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const [messages] = await Promise.all([
    prisma.coachMessage.findMany({ where: { clientId: ctx.clientId, channel: "NUTRITION" }, orderBy: { createdAt: "asc" }, take: 300 }),
    prisma.coachMessage.updateMany({ where: { clientId: ctx.clientId, channel: "NUTRITION", sender: { not: "CLIENT" }, readAt: null }, data: { readAt: new Date() } }),
  ])
  return (
    <ChatScreen title="🥗 Tu nutricionista" subtitle="Dudas sobre tu plan, cómo te sentiste, qué comiste…" back="/app/nutrition">
      <ChatPanel
        mode="client"
        channel="NUTRITION"
        safeBottom
        className="flex-1"
        initialMessages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
      />
    </ChatScreen>
  )
}
