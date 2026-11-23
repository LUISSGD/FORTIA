import Anthropic from "@anthropic-ai/sdk"
import { createHash } from "node:crypto"
import { z } from "zod"
import { formatYmdLong, todayYmd } from "@/lib/coaching/dates"
import { AI_MODEL, costUsd, MAX_OUTPUT_TOKENS, MAX_STEPS, type TokenUsage } from "./config"
import { questionContext, SYSTEM_PROMPT } from "./prompt"
import { runTool, TOOLS, type Draft } from "./tools"

// Conversación con la IA: envía la pregunta, ejecuta las consultas que pida y va entregando la respuesta.
// La historia solo se agrega al final (nunca se edita): la IA necesita recibir sus propios bloques tal cual.

export type Msg = Anthropic.Beta.BetaMessageParam
export type AssistantEvent =
  | { type: "text"; text: string }
  | { type: "tool"; label: string }
  | { type: "draft"; draft: Draft }
  /** Se corta el texto de este paso y se vuelve a generar */
  | { type: "restart" }
  | { type: "error"; message: string }
  | { type: "done" }

export type UsageRow = { model: string; costUsd: number } & TokenUsage

const API_TOOLS: Anthropic.Beta.BetaTool[] = TOOLS.map((t) => {
  const schema = z.toJSONSchema(t.schema, { target: "draft-7" }) as Record<string, unknown>
  delete schema.$schema
  return { name: t.name, description: t.description, input_schema: schema as Anthropic.Beta.BetaTool.InputSchema, eager_input_streaming: true }
})

/** Cambia cuando cambian las instrucciones, las consultas o el modelo. */
export const PROMPT_KEY = createHash("sha256").update(JSON.stringify([AI_MODEL, SYSTEM_PROMPT, API_TOOLS])).digest("hex").slice(0, 16)

/**
 * Lo que la IA razonó solo vale con las mismas instrucciones. Si cambiaron (una versión nueva de la app), se quita de
 * la historia; las preguntas, respuestas y consultas se conservan.
 */
export function stripThinking(history: Msg[]): Msg[] {
  return history.map((m) => {
    if (m.role !== "assistant" || !Array.isArray(m.content)) return m
    const content = m.content.filter((b) => b.type !== "thinking" && b.type !== "redacted_thinking")
    return { ...m, content: content.length ? content : [{ type: "text", text: "…" }] }
  })
}

function toUsage(message: Anthropic.Beta.BetaMessage): UsageRow {
  const u = message.usage
  const fallback = (u.iterations ?? []).some((i) => i.type === "fallback_message")
  const t: TokenUsage = { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 }
  return { model: message.model, ...t, costUsd: costUsd(t, fallback) }
}

function friendlyError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return "La clave de la IA no es válida o no tiene permiso. Revísala en Vercel (ANTHROPIC_API_KEY)."
  if (e instanceof Anthropic.RateLimitError) return "La IA está recibiendo demasiados pedidos. Espera un minuto y vuelve a intentar."
  if (e instanceof Anthropic.BadRequestError && /credit|billing/i.test(e.message)) return "La cuenta de la IA no tiene saldo. Recárgala en platform.claude.com."
  if (e instanceof Anthropic.InternalServerError) return "La IA está con problemas en este momento. Intenta de nuevo en unos minutos."
  return "No se pudo completar la respuesta. Intenta de nuevo."
}

/**
 * Responde una pregunta. Devuelve los mensajes nuevos para guardarlos, o null si no terminó bien
 * (en ese caso no se guarda nada y la conversación queda como estaba).
 */
export async function runAssistant(args: {
  history: Msg[]
  question: string
  emit: (e: AssistantEvent) => void
  /** Se llama antes de cada llamada a la IA: si devuelve un texto, se detiene ahí (tope de gasto). */
  canSpend: () => Promise<string | null>
  onUsage: (u: UsageRow) => Promise<void>
  signal?: AbortSignal
  client?: Anthropic
}): Promise<Msg[] | null> {
  const { history, question, emit, canSpend, onUsage, signal } = args
  const client = args.client ?? new Anthropic()
  const ymd = todayYmd()
  const added: Msg[] = [{ role: "user", content: [{ type: "text", text: questionContext(formatYmdLong(ymd), ymd) }, { type: "text", text: question }] }]
  let parseRetries = 0

  for (let step = 0; step < MAX_STEPS; step++) {
    const blocked = await canSpend()
    if (blocked) {
      emit({ type: "error", message: blocked })
      return null
    }

    const stream = client.beta.messages.stream(
      {
        model: AI_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        tools: API_TOOLS,
        messages: [...history, ...added],
        output_config: { effort: "medium" },
        cache_control: { type: "ephemeral" },
        // Si un filtro de seguridad rechaza la pregunta por error, la responde el modelo de respaldo
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal },
    )
    stream.on("text", (text) => emit({ type: "text", text }))

    let message: Anthropic.Beta.BetaMessage
    try {
      message = await stream.finalMessage()
      parseRetries = 0
    } catch (e) {
      // Lo ya generado también se cobra: se registra aunque la respuesta se haya cortado
      if (stream.currentMessage) await onUsage(toUsage(stream.currentMessage)).catch(() => {})
      if (signal?.aborted) return null
      if (!(e instanceof Anthropic.APIError) && parseRetries++ < 1) {
        emit({ type: "restart" })
        continue
      }
      console.error("[asistente]", e instanceof Anthropic.APIError ? `${e.status} ${e.type ?? ""} ${e.message}` : (e as Error).message)
      emit({ type: "error", message: friendlyError(e) })
      return null
    }
    await onUsage(toUsage(message))

    if (message.stop_reason === "refusal") {
      emit({ type: "error", message: "La IA no pudo responder esa pregunta. Intenta preguntarlo de otra forma." })
      return null
    }
    const calls = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
    if (message.stop_reason === "max_tokens" && calls.length) {
      emit({ type: "error", message: "La respuesta salió demasiado larga y se cortó. Pídela por partes." })
      return null
    }
    added.push({ role: "assistant", content: message.content as Anthropic.Beta.BetaContentBlockParam[] })
    if (message.stop_reason === "pause_turn") continue
    if (!calls.length) {
      if (message.stop_reason === "max_tokens") emit({ type: "text", text: "\n\n_(La respuesta se cortó por larga. Escribe “continúa”.)_" })
      emit({ type: "done" })
      return added
    }

    for (const c of calls) emit({ type: "tool", label: TOOLS.find((t) => t.name === c.name)?.label ?? "Consultando" })
    const results = await Promise.all(calls.map(async (c): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
      const out = await runTool(c.name, c.input)
      if (out.draft) emit({ type: "draft", draft: out.draft })
      return { type: "tool_result", tool_use_id: c.id, content: out.content, is_error: out.isError }
    }))
    added.push({ role: "user", content: results })
  }

  emit({ type: "error", message: "La pregunta necesitó demasiadas consultas. Hazla más específica." })
  return null
}
