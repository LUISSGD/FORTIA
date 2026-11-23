import { prisma } from "@/lib/prisma"
import { todayYmd } from "@/lib/coaching/dates"
import { KEEP_DAYS, monthlyLimitUsd } from "./config"
import { PROMPT_KEY, stripThinking, type Msg, type UsageRow } from "./run"
import { runTool, TOOLS, type Draft } from "./tools"

// Conversaciones guardadas y gasto del asistente.

const yearMonth = () => todayYmd().slice(0, 7)

export async function getSpend() {
  const s = await prisma.aiUsage.aggregate({ where: { yearMonth: yearMonth() }, _sum: { costUsd: true } })
  return { spentUsd: Math.round((s._sum.costUsd ?? 0) * 100) / 100, limitUsd: monthlyLimitUsd() }
}

/** Texto para mostrar si ya se llegó al tope del mes; null si se puede seguir. */
export async function canSpend(): Promise<string | null> {
  const { spentUsd, limitUsd } = await getSpend()
  return spentUsd >= limitUsd ? `Llegaste al tope de este mes (US$ ${limitUsd}). Se renueva el día 1, o puedes subirlo en Vercel con AI_MONTHLY_LIMIT_USD.` : null
}

export async function saveUsage(u: UsageRow) {
  await prisma.aiUsage.create({ data: { yearMonth: yearMonth(), model: u.model, inputTokens: u.input, outputTokens: u.output, cacheReadTokens: u.cacheRead, cacheWriteTokens: u.cacheWrite, costUsd: u.costUsd } })
}

export async function listConversations(userId: string) {
  await prisma.aiConversation.deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } })
  return prisma.aiConversation.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, title: true, updatedAt: true } })
}

export async function loadConversation(id: string, userId: string) {
  const c = await prisma.aiConversation.findFirst({ where: { id, userId } })
  if (!c) return null
  const stored = JSON.parse(c.messages) as Msg[]
  return { id: c.id, title: c.title, version: c.version, history: c.promptKey === PROMPT_KEY ? stored : stripThinking(stored) }
}

/** Guarda la conversación completa. Devuelve su id, o null si cambió en otra ventana mientras tanto. */
export async function saveConversation(args: { userId: string; current: { id: string; version: number } | null; question: string; messages: Msg[] }): Promise<string | null> {
  const messages = JSON.stringify(args.messages)
  if (!args.current) {
    const title = args.question.replace(/\s+/g, " ").trim().slice(0, 70)
    return (await prisma.aiConversation.create({ data: { userId: args.userId, title, messages, promptKey: PROMPT_KEY }, select: { id: true } })).id
  }
  const r = await prisma.aiConversation.updateMany({ where: { id: args.current.id, userId: args.userId, version: args.current.version }, data: { messages, promptKey: PROMPT_KEY, version: { increment: 1 } } })
  return r.count ? args.current.id : null
}

export const deleteConversation = (id: string, userId: string) => prisma.aiConversation.deleteMany({ where: { id, userId } })

const isQuestion = (m: Msg) => m.role === "user" && Array.isArray(m.content) && m.content.some((b) => b.type === "text")
export const countTurns = (history: Msg[]) => history.filter(isQuestion).length

export type Part = { type: "text"; text: string } | { type: "tool"; label: string } | { type: "draft"; draft: Draft }
export type Turn = { role: "user"; text: string } | { role: "assistant"; parts: Part[] }

/** Lo que se muestra en pantalla: sin contexto interno ni resultados de consultas. Los borradores se rearman. */
export async function toTurns(history: Msg[]): Promise<Turn[]> {
  const turns: Turn[] = []
  for (const m of history) {
    if (!Array.isArray(m.content)) continue
    if (m.role === "user") {
      const texts = m.content.flatMap((b) => (b.type === "text" ? [b.text] : []))
      if (texts.length) turns.push({ role: "user", text: texts.slice(1).join("\n") })
      continue
    }
    let last = turns.at(-1)
    if (!last || last.role !== "assistant") turns.push((last = { role: "assistant", parts: [] }))
    for (const b of m.content) {
      if (b.type === "text" && b.text.trim()) last.parts.push({ type: "text", text: b.text })
      if (b.type === "tool_use") {
        last.parts.push({ type: "tool", label: TOOLS.find((t) => t.name === b.name)?.label ?? "Consultando" })
        if (b.name === "borrador_whatsapp") {
          const { draft } = await runTool(b.name, b.input)
          if (draft) last.parts.push({ type: "draft", draft })
        }
      }
    }
  }
  return turns
}
