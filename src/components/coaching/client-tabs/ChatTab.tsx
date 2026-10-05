import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { Panel } from "@/components/coaching/kit"
import ChatPanel from "@/components/coaching/ChatPanel"

/**
 * Pestaña "Chat" de la ficha del cliente.
 * - Canal coaching: el chat compartido del coach y el entrenador (cada mensaje lleva su autor).
 * - Canal nutrición (solo ADMIN, `showNutrition`): conversación con la nutricionista en solo lectura,
 *   sin marcar como leídos los mensajes del cliente.
 */
export default async function ChatTab({ clientId, showNutrition = false, nutrition = false }: { clientId: string; showNutrition?: boolean; nutrition?: boolean }) {
  const viewNutrition = showNutrition && nutrition
  const channel = viewNutrition ? "NUTRITION" : "COACHING"
  const [messages, nutritionCount, nutritionUnread] = await Promise.all([
    prisma.coachMessage.findMany({ where: { clientId, channel }, orderBy: { createdAt: "asc" }, take: 300 }),
    showNutrition ? prisma.coachMessage.count({ where: { clientId, channel: "NUTRITION" } }) : 0,
    showNutrition ? prisma.coachMessage.count({ where: { clientId, channel: "NUTRITION", sender: "CLIENT", readAt: null } }) : 0,
    viewNutrition ? null : prisma.coachMessage.updateMany({ where: { clientId, channel: "COACHING", sender: "CLIENT", readAt: null }, data: { readAt: new Date() } }),
  ])
  const initial = messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))

  return (
    <div className="space-y-3">
      {showNutrition && (
        <div className="flex gap-2 flex-wrap">
          <Link href="?tab=chat" className={cn("px-3 py-1.5 rounded-full text-sm", !viewNutrition ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            💬 Coach y entrenador
          </Link>
          <Link href="?tab=chat&canal=nutricion" className={cn("px-3 py-1.5 rounded-full text-sm", viewNutrition ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            🥗 Nutricionista{nutritionCount ? ` (${nutritionCount})` : ""}
            {nutritionUnread > 0 && <span className="ml-1 rounded-full bg-orange-500 text-white text-[10px] px-1.5">{nutritionUnread} sin leer</span>}
          </Link>
        </div>
      )}
      {viewNutrition && (
        <p className="text-xs text-gray-500">Conversación del cliente con la nutricionista. Solo lectura: no marca los mensajes como leídos.</p>
      )}
      <Panel className="p-0 overflow-hidden">
        {viewNutrition ? (
          <ChatPanel key="nutrition" mode="nutritionist" clientId={clientId} readOnly className="h-[65vh]" initialMessages={initial} />
        ) : (
          <ChatPanel key="coaching" mode="coach" clientId={clientId} className="h-[65vh]" initialMessages={initial} />
        )}
      </Panel>
    </div>
  )
}
