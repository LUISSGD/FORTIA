import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import ChatPanel from "@/components/coaching/ChatPanel"
import ChatScreen from "@/components/coaching/app/ChatScreen"

export default async function ClientChatPage() {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const [messages] = await Promise.all([
    prisma.coachMessage.findMany({ where: { clientId: ctx.clientId, channel: "COACHING" }, orderBy: { createdAt: "asc" }, take: 300 }),
    prisma.coachMessage.updateMany({ where: { clientId: ctx.clientId, channel: "COACHING", sender: { not: "CLIENT" }, readAt: null }, data: { readAt: new Date() } }),
    prisma.notification.updateMany({ where: { clientId: ctx.clientId, type: "MESSAGE", readAt: null }, data: { readAt: new Date() } }),
  ])
  return (
    <ChatScreen title="💬 Tu coach" subtitle="Dudas, molestias, fotos de tu comida, videos de técnica…" back="/app">
      <ChatPanel mode="client" safeBottom className="flex-1" initialMessages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))} />
    </ChatScreen>
  )
}
