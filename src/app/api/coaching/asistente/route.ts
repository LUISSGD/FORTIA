import { NextResponse } from "next/server"
import { jsonError, requireCoach, str } from "@/lib/coaching/auth"
import { isAssistantReady, MAX_QUESTION_CHARS, MAX_TURNS } from "@/lib/assistant/config"
import { runAssistant, type AssistantEvent } from "@/lib/assistant/run"
import { canSpend, countTurns, getSpend, listConversations, loadConversation, saveConversation, saveUsage } from "@/lib/assistant/store"

export const dynamic = "force-dynamic"
export const maxDuration = 180

export async function GET() {
  const { error, session } = await requireCoach()
  if (error) return error
  const [conversations, spend] = await Promise.all([listConversations(session.user.id!), getSpend()])
  return NextResponse.json({ conversations, spend })
}

/** Pregunta al asistente. Responde por partes: una línea JSON por evento. */
export async function POST(request: Request) {
  const { error, session } = await requireCoach()
  if (error) return error
  if (!isAssistantReady()) return jsonError("Falta cargar la clave de la IA en Vercel.", 503)
  const userId = session.user.id!

  const body = (await request.json().catch(() => null)) as { question?: unknown; conversationId?: unknown } | null
  const question = str(body?.question)
  if (!question) return jsonError("Escribe tu pregunta")
  if (question.length > MAX_QUESTION_CHARS) return jsonError(`La pregunta es muy larga (máximo ${MAX_QUESTION_CHARS} letras)`)

  const id = str(body?.conversationId)
  const current = id ? await loadConversation(id, userId) : null
  if (id && !current) return jsonError("Esa conversación ya no existe", 404)
  if (current && countTurns(current.history) >= MAX_TURNS) return jsonError("Esta conversación ya es muy larga. Empieza una nueva para que siga siendo rápida y barata.")

  const abort = new AbortController()
  request.signal.addEventListener("abort", () => abort.abort())
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AssistantEvent | { type: "saved"; id: string; spend: Awaited<ReturnType<typeof getSpend>> }) => {
        if (!abort.signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`))
      }
      try {
        const history = current?.history ?? []
        const added = await runAssistant({ history, question, emit: (e) => e.type !== "done" && send(e), canSpend, onUsage: saveUsage, signal: abort.signal })
        if (added) {
          const savedId = await saveConversation({ userId, current, question, messages: [...history, ...added] })
          if (savedId) send({ type: "saved", id: savedId, spend: await getSpend() })
          else send({ type: "error", message: "Esta conversación cambió en otra ventana: la respuesta no se guardó. Ábrela de nuevo para continuar." })
        }
      } catch (e) {
        console.error("[asistente]", (e as Error).message)
        send({ type: "error", message: "No se pudo completar la respuesta. Intenta de nuevo." })
      }
      try {
        controller.close()
      } catch {
        // El navegador ya cerró la conexión
      }
    },
    cancel() {
      abort.abort()
    },
  })
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform" } })
}
