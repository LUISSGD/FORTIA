import { prisma } from "@/lib/prisma"
import { Panel } from "@/components/coaching/kit"
import ChatPanel from "@/components/coaching/ChatPanel"

/** Pestaña "Chat": mismo chat del cliente para el coach y el entrenador (cada mensaje lleva su autor). */
export default async function ChatTab({ clientId }: { clientId: string }) {
  const [messages] = await Promise.all([
    prisma.coachMessage.findMany({ where: { clientId }, orderBy: { createdAt: "asc" }, take: 300 }),
    prisma.coachMessage.updateMany({ where: { clientId, sender: "CLIENT", readAt: null }, data: { readAt: new Date() } }),
  ])
  return (
    <Panel className="p-0 overflow-hidden">
      <ChatPanel mode="coach" clientId={clientId} className="h-[65vh]" initialMessages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))} />
    </Panel>
  )
}
