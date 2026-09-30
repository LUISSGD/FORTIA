import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import ChatPanel from "@/components/coaching/ChatPanel"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function NutritionChatPage() {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const [messages] = await Promise.all([
    prisma.coachMessage.findMany({ where: { clientId: ctx.clientId, channel: "NUTRITION" }, orderBy: { createdAt: "asc" }, take: 300 }),
    prisma.coachMessage.updateMany({ where: { clientId: ctx.clientId, channel: "NUTRITION", sender: { not: "CLIENT" }, readAt: null }, data: { readAt: new Date() } }),
  ])
  return (
    <div className="-mx-4 -mt-4 -mb-28">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <Link href="/app/nutrition" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="font-black">🥗 Tu nutricionista</p>
          <p className="text-xs text-gray-400">Dudas sobre tu plan, cómo te sentiste, qué comiste…</p>
        </div>
      </div>
      <ChatPanel
        mode="client"
        channel="NUTRITION"
        className="h-[calc(100dvh-10.5rem)]"
        initialMessages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
      />
    </div>
  )
}
