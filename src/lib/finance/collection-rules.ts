// Reglas de la Cobranza (funciones puras, sin base de datos): a quién escribir hoy y con qué mensaje.

/** RENEWAL = membresía (va por fecha), PT = paquete personalizado (va por clases), BALANCE = saldo de un pago. */
export type Kind = "RENEWAL" | "BALANCE" | "PT"
export type Area = "MEMBERSHIP" | "PT"
export type Step = "PRE" | "DUE" | "LATE" | "REACTIVATE" | "PROMISE"
export type Outcome = "SENT" | "PROMISED" | "DISMISSED"
export type Record_ = { step: string; outcome: string; promiseYmd: string | null; atYmd: string }

export const RENEWAL_PRE_DAYS = 5
export const BALANCE_PRE_DAYS = 3
export const REACTIVATE_FROM = 7
export const REACTIVATE_TO = 60
/** Lo vencido (renovación de un cliente activo o saldo) se vuelve a recordar cada 7 días mientras no se pague. */
export const LATE_REPEAT_DAYS = 7

/**
 * Paso de seguimiento de una renovación según los días que faltan (negativo = ya venció).
 * Un cliente que sigue viniendo se cobra ("ya venció") aunque pasen semanas; "reactivar" es solo para
 * quien ya se fue (stand-by o marcado "no renueva").
 */
export function renewalStep(daysLeft: number, gone: boolean): Exclude<Step, "PROMISE"> | null {
  if (daysLeft < -REACTIVATE_TO) return null
  if (gone) return daysLeft <= -REACTIVATE_FROM ? "REACTIVATE" : null
  if (daysLeft === 0) return "DUE"
  if (daysLeft < 0) return "LATE"
  return daysLeft <= RENEWAL_PRE_DAYS ? "PRE" : null
}

/** Paso de seguimiento de un saldo pendiente. Sin fecha límite, se trata como vencido. */
export function balanceStep(daysLeft: number | null): "PRE" | "DUE" | "LATE" | null {
  if (daysLeft === null || daysLeft < 0) return "LATE"
  if (daysLeft === 0) return "DUE"
  return daysLeft <= BALANCE_PRE_DAYS ? "PRE" : null
}

/** Una semana después de terminar su paquete personalizado, pasa de "terminó" a "terminó hace más de una semana". */
export const PT_LATE_DAYS = 7

/**
 * Paso de seguimiento de un paquete personalizado: va por clases, no por la fecha de la membresía.
 * PRE = le quedan pocas clases o su última clase es pronto; DUE = terminó hace menos de una semana; LATE = hace más
 * (se repite cada semana hasta 60 días después de terminar).
 */
export function ptStep(state: string, daysSinceEnd: number | null): "PRE" | "DUE" | "LATE" | null {
  if (state === "renew") return "PRE"
  if (state !== "ended") return null
  // Igual que en membresías: después de 60 días ya no se le escribe por este paquete
  if (daysSinceEnd !== null && daysSinceEnd > REACTIVATE_TO) return null
  return daysSinceEnd !== null && daysSinceEnd >= PT_LATE_DAYS ? "LATE" : "DUE"
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000)

/**
 * Qué mostrar hoy para un vencimiento o saldo, según lo ya registrado en este ciclo.
 * - `step`: toca escribirle hoy (PROMISE = hoy se cumple su promesa de pago).
 * - `waiting`: prometió pagar más adelante; vuelve ese día.
 */
export function nextAction(args: { natural: Exclude<Step, "PROMISE"> | null; records: Record_[]; today: string }): { step: Step | null; waiting: string | null } {
  const { natural, records, today } = args
  if (records.some((r) => r.outcome === "DISMISSED")) return { step: null, waiting: null }

  const promise = records
    .filter((r) => r.outcome === "PROMISED" && r.promiseYmd)
    .sort((a, b) => b.atYmd.localeCompare(a.atYmd) || b.promiseYmd!.localeCompare(a.promiseYmd!))[0]
  if (promise) {
    if (promise.promiseYmd! > today) return { step: null, waiting: promise.promiseYmd }
    const reminded = records.some((r) => r.step === "PROMISE" && r.outcome === "SENT" && r.atYmd >= promise.promiseYmd!)
    if (!reminded) return { step: "PROMISE", waiting: null }
  }

  if (!natural) return { step: null, waiting: null }
  // Lo vencido se recuerda cada semana (cuenta el último mensaje, sea de este paso o de su promesa)
  if (natural === "LATE") {
    const last = records.filter((r) => r.step === "LATE" || r.step === "PROMISE").map((r) => r.atYmd).sort().at(-1)
    return { step: last && daysBetween(today, last) < LATE_REPEAT_DAYS ? null : "LATE", waiting: null }
  }
  return { step: records.some((r) => r.step === natural) ? null : natural, waiting: null }
}

/** Mensajes de fábrica. Se pueden editar en Cobranza; {monto} solo sale si Luis lo agrega al texto. */
export const TEMPLATES: { key: string; label: string; text: string }[] = [
  { key: "RENEWAL_PRE", label: "Membresía: antes de vencer", text: "¡Hola {nombre}! 👋 Te recuerdo que tu plan en FORTIA ({plan}) vence el {fecha}. ¿Te ayudo a renovarlo para que sigas sin parar? 💪" },
  { key: "RENEWAL_DUE", label: "Membresía: vence hoy", text: "¡Hola {nombre}! Hoy vence tu plan en FORTIA ({plan}). ¿Lo renovamos hoy para que mantengas tu ritmo? 💪" },
  { key: "RENEWAL_LATE", label: "Membresía: ya venció", text: "¡Hola {nombre}! Tu plan en FORTIA venció el {fecha}. ¿Todo bien? Si quieres te ayudo a renovarlo hoy mismo 🙌" },
  { key: "RENEWAL_REACTIVATE", label: "Membresía: reactivar (más de una semana)", text: "¡Hola {nombre}! Te extrañamos en FORTIA 💪 ¿Cómo vas? Si quieres retomar, te ayudo a elegir el plan que mejor te acomode." },
  { key: "BALANCE_PRE", label: "Saldo: por vencer", text: "¡Hola {nombre}! 👋 Te recuerdo que el saldo de tu plan en FORTIA vence el {fecha}. ¡Gracias! 🙌" },
  { key: "BALANCE_LATE", label: "Saldo: vencido", text: "¡Hola {nombre}! Quedó pendiente el saldo de tu plan en FORTIA, que vencía el {fecha}. ¿Me ayudas a regularizarlo? ¡Gracias! 🙌" },
  { key: "PT_PRE", label: "Personalizado: le quedan pocas clases", text: "¡Hola {nombre}! Te quedan {clases} de tu paquete personalizado en FORTIA ({plan}). ¿Coordinamos la renovación para no cortar tu avance? 💪" },
  { key: "PT_DUE", label: "Personalizado: terminó su paquete", text: "¡Hola {nombre}! Terminaste tu paquete personalizado en FORTIA ({plan}) 💪 ¿Lo renovamos para seguir con tu plan?" },
  { key: "PT_LATE", label: "Personalizado: terminó hace más de una semana", text: "¡Hola {nombre}! Ya pasaron unos días desde tu último personalizado en FORTIA. ¿Retomamos? Te ayudo a renovar tu paquete 🙌" },
  { key: "PROMISE", label: "El día que prometió pagar", text: "¡Hola {nombre}! Quedamos en que hoy regularizabas tu pago en FORTIA. ¿Me avisas cuando lo hagas? ¡Gracias! 🙌" },
]

export function templateKey(kind: Kind, step: Step): string {
  if (step === "PROMISE") return "PROMISE"
  if (kind === "PT") return `PT_${step === "REACTIVATE" ? "LATE" : step}`
  if (kind === "BALANCE") return step === "LATE" ? "BALANCE_LATE" : "BALANCE_PRE"
  return `RENEWAL_${step}`
}

/** Reemplaza {nombre}, {plan}, {fecha}, {monto} y {clases}. Sin plan, se quita el paréntesis vacío. */
export function fillMessage(text: string, vars: { nombre: string; plan: string; fecha: string; monto: string; clases?: string }) {
  return text.replace(/\{(nombre|plan|fecha|monto|clases)\}/g, (_, k: keyof typeof vars) => vars[k] ?? "").replace(/\s*\(\s*\)/g, "").trim()
}
