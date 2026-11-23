import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isAssistantReady } from "@/lib/assistant/config"
import { getSpend, listConversations } from "@/lib/assistant/store"
import AssistantChat from "@/components/coaching/assistant/AssistantChat"
import { withCoachErrors } from "@/components/coaching/withCoachErrors"

export const dynamic = "force-dynamic"

async function AsistentePage() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") redirect("/login")
  const [conversations, spend] = await Promise.all([listConversations(session.user.id!), getSpend()])
  return <AssistantChat ready={isAssistantReady()} initialConversations={conversations.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() }))} initialSpend={spend} />
}

export default withCoachErrors("Asistente", AsistentePage)
