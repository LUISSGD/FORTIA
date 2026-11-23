// Asistente con IA: modelo, precios y límites. Solo lo usa el administrador.

export const AI_MODEL = "claude-opus-5-5"

/** Tope de gasto mensual en dólares. Se cambia en Vercel con AI_MONTHLY_LIMIT_USD. */
export function monthlyLimitUsd(): number {
  const n = Number(process.env.AI_MONTHLY_LIMIT_USD)
  return Number.isFinite(n) && n > 0 ? n : 15
}

export const isAssistantReady = () => !!process.env.ANTHROPIC_API_KEY?.trim()

/** Vueltas de consulta por pregunta: evita que una sola pregunta gaste sin control. */
export const MAX_STEPS = 10
export const MAX_OUTPUT_TOKENS = 16_000
/** Preguntas por conversación: cada una vuelve a enviar lo anterior, así que las largas cuestan más. */
export const MAX_TURNS = 25
export const MAX_QUESTION_CHARS = 3_000
export const KEEP_DAYS = 60

// Dólares por millón de tokens. El segundo renglón es para cuando responde el modelo de respaldo (se cobra más caro).
const PRICES = {
  main: { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  fallback: { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
}

export type TokenUsage = { input: number; output: number; cacheRead: number; cacheWrite: number }

export function costUsd(u: TokenUsage, usedFallback = false): number {
  const p = usedFallback ? PRICES.fallback : PRICES.main
  return (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1_000_000
}
