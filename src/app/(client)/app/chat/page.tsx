import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import ChatPanel from "@/components/coaching/ChatPanel"

export default async function ClientChatPage() {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const [messages] = await Promise.all([
    prisma.coachMessage.findMany({ where: { clientId: ctx.clientId }, orderBy: { createdAt: "asc" }, take: 300 }),
    prisma.coachMessage.updateMany({ where: { clientId: ctx.clientId, sender: { not: "CLIENT" }, readAt: null }, data: { readAt: new Date() } }),
    prisma.notification.updateMany({ where: { clientId: ctx.clientId, type: "MESSAGE", readAt: null }, data: { readAt: new Date() } }),
  ])
  return (
    <div className="-mx-4 -mt-4 -mb-28">
      <div className="px-4 py-3 border-b border-zinc-900">
        <p className="font-black">💬 Tu coach</p>
        <p className="text-xs text-zinc-500">Dudas, molestias, fotos de tu comida, videos de técnica…</p>
      </div>
      <ChatPanel mode="client" dark className="h-[calc(100dvh-10.5rem)]" initialMessages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))} />
    </div>
  )
}
