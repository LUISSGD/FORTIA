// Interesados: reglas puras (sin base de datos), compartidas entre el servidor y la pantalla.

export const LEAD_STAGES = ["NEW", "CONTACTED", "TRIAL", "WON", "LOST"] as const
export type LeadStage = (typeof LEAD_STAGES)[number]
export const STAGE_LABEL: Record<LeadStage, string> = { NEW: "Nuevo", CONTACTED: "Contactado", TRIAL: "Clase de prueba", WON: "Alumno", LOST: "Perdido" }

export const LEAD_SOURCES = ["WEB", "INSTAGRAM", "WHATSAPP", "REFERIDO", "OTRO"] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]
export const SOURCE_LABEL: Record<LeadSource, string> = { WEB: "Web", INSTAGRAM: "Instagram", WHATSAPP: "WhatsApp", REFERIDO: "Referido", OTRO: "Otro" }

export const LOST_REASONS = ["No respondió", "Precio", "Horario", "Distancia", "Eligió otro lugar", "Otro"]

/** Etapa del interesado según el estado de su clase de prueba (los que ya cerraron no retroceden). */
export function stageFromTrial(current: string, trial: { status: string; clientId: string | null }): LeadStage {
  if (trial.clientId || current === "WON") return "WON"
  if (trial.status === "CANCELLED") return current === "TRIAL" ? "CONTACTED" : (current as LeadStage)
  return "TRIAL"
}

/** Por qué requiere atención hoy, o null. `hours` = horas desde que llegó. */
export function leadAlert(l: { stage: string; hours: number; nextContactOn: string | null; trialStatus: string | null; trialDate: string | null }, today: string): string | null {
  if (l.stage === "WON" || l.stage === "LOST") return null
  if (l.nextContactOn) return l.nextContactOn < today ? "Contacto atrasado" : l.nextContactOn === today ? "Contactar hoy" : null
  if (l.stage === "NEW" && l.hours >= 24) return "Sin responder hace más de 24 h"
  if (l.stage === "TRIAL" && l.trialStatus === "ATTENDED") return "Ya vino: cerrar la venta"
  if (l.stage === "TRIAL" && l.trialStatus === "NO_SHOW") return "No vino: reagendar"
  if (l.stage === "TRIAL" && l.trialStatus === "SCHEDULED" && l.trialDate && l.trialDate < today) return "Clase pasada sin marcar"
  return null
}

/** Mensaje de WhatsApp según la etapa (se puede editar antes de enviarlo). */
export function leadMessage(l: { firstName: string; stage: string; goal: string | null; trialStatus: string | null }): string {
  const n = l.firstName.trim()
  if (l.stage === "TRIAL" && l.trialStatus === "ATTENDED") return `¡Hola ${n}! 💪 ¿Cómo te sentiste en tu clase de prueba en FORTIA? Cuéntame y te ayudo a elegir el plan que mejor te acomode.`
  if (l.stage === "TRIAL" && l.trialStatus === "NO_SHOW") return `¡Hola ${n}! Te esperamos en tu clase de prueba en FORTIA y no pudiste venir. ¿Te la reagendo? ¿Qué día te acomoda?`
  if (l.stage === "CONTACTED") return `¡Hola ${n}! ¿Pudiste pensarlo? Si quieres, te agendo una clase de prueba en FORTIA para que lo vivas. ¿Qué día te acomoda? 🙌`
  return `¡Hola ${n}! 👋 Soy de FORTIA. Gracias por escribirnos${l.goal ? `: vi que tu objetivo es ${l.goal.trim().toLowerCase()}` : ""}. ¿Te agendo una clase de prueba? ¿Qué días y horarios te acomodan?`
}
