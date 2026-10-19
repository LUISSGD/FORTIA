export type Entrenador = "HEAD_COACH" | "JULIO" | "TEAM_FORTIA"
export type Modalidad = "ELITE_ATHLETE" | "ELITE_ATHLETE_PAREJAS"
// ANTERIOR = precios "Regular" de Head Coach vigentes hasta oct. 2026 (los conservan los clientes que ya estaban)
// PERSONALIZADO = paquete a medida (número de clases y precio libres), sin precio en la tabla
export type Tarifa = "OPENING" | "REGULAR" | "ANTERIOR" | "PERSONALIZADO"
export type NumPacks = 1 | 3 | 6
export type ClasesPerPack = 4 | 8 | 12 | 16

type PriceMap = Partial<Record<NumPacks, Partial<Record<ClasesPerPack, number>>>>
type TarifaMap = Partial<Record<Tarifa, PriceMap>>
type ModalidadMap = Partial<Record<Modalidad, TarifaMap>>
type EntrenadorMap = Partial<Record<Entrenador, ModalidadMap>>

// Tarifario vigente desde oct. 2026: Team Fortia, Julio y Head Coach (1 pack = 4 semanas, 3 packs = 3 meses).
export const TRAINING_PRICING: EntrenadorMap = {
  HEAD_COACH: {
    ELITE_ATHLETE: {
      REGULAR: {
        1: { 8: 1280, 12: 1800, 16: 2240 },
        3: { 8: 3360, 12: 4860, 16: 6000 },
      },
      OPENING: {
        1: { 8: 780,  12: 1050, 16: 1350 },
        3: { 8: 2125, 12: 3000, 16: 3850 },
        6: { 8: 4000, 12: 5500, 16: 7250 },
      },
      ANTERIOR: {
        1: { 8: 920,  12: 1200, 16: 1520 },
        3: { 8: 2580, 12: 3400, 16: 4320 },
        6: { 8: 4750, 12: 6250, 16: 8000 },
      },
    },
    ELITE_ATHLETE_PAREJAS: {
      REGULAR: {
        1: { 8: 1680, 12: 2340, 16: 2920 },
        3: { 8: 4560, 12: 6300, 16: 7920 },
      },
      OPENING: {
        1: { 8: 1050, 12: 1200, 16: 1520 },
        3: { 8: 3000, 12: 3500, 16: 4300 },
        6: { 8: 5600, 12: 6600, 16: 8400 },
      },
      ANTERIOR: {
        1: { 8: 1200, 12: 1440, 16: 1760 },
        3: { 8: 3300, 12: 4000, 16: 4920 },
        6: { 8: 6000, 12: 7560, 16: 9400 },
      },
    },
  },
  JULIO: {
    ELITE_ATHLETE: {
      REGULAR: {
        1: { 8: 920,  12: 1200, 16: 1520 },
        3: { 8: 2580, 12: 3400, 16: 4320 },
      },
    },
    ELITE_ATHLETE_PAREJAS: {
      REGULAR: {
        1: { 8: 1200, 12: 1440, 16: 1760 },
        3: { 8: 3300, 12: 4000, 16: 4920 },
      },
    },
  },
  TEAM_FORTIA: {
    ELITE_ATHLETE: {
      REGULAR: {
        1: { 4: 420, 8: 840, 12: 1050, 16: 1350 },
        3: { 8: 2250, 12: 2780, 16: 3700 },
      },
    },
    ELITE_ATHLETE_PAREJAS: {
      REGULAR: {
        1: { 8: 1050, 12: 1200, 16: 1520 },
        3: { 8: 3000, 12: 3500, 16: 4250 },
      },
    },
  },
}

export function getTrainingPrice(
  entrenador: Entrenador,
  modalidad: Modalidad,
  tarifa: Tarifa,
  numPacks: NumPacks,
  clasesPerPack: ClasesPerPack
): number | null {
  return TRAINING_PRICING[entrenador]?.[modalidad]?.[tarifa]?.[numPacks]?.[clasesPerPack] ?? null
}

export function getAvailableModalidades(entrenador: Entrenador): Modalidad[] {
  return Object.keys(TRAINING_PRICING[entrenador] ?? {}) as Modalidad[]
}

export function getAvailableTarifas(entrenador: Entrenador, modalidad: Modalidad): Tarifa[] {
  return Object.keys(TRAINING_PRICING[entrenador]?.[modalidad] ?? {}) as Tarifa[]
}

export function getAvailableNumPacks(entrenador: Entrenador, modalidad: Modalidad, tarifa: Tarifa): NumPacks[] {
  return Object.keys(TRAINING_PRICING[entrenador]?.[modalidad]?.[tarifa] ?? {}).map(Number) as NumPacks[]
}

export const ENTRENADOR_LABELS: Record<Entrenador, string> = {
  HEAD_COACH: "Head Coach",
  JULIO: "Julio",
  TEAM_FORTIA: "Team Fortia",
}

/** Orden en los selectores de entrenador. */
export const ENTRENADORES: Entrenador[] = ["HEAD_COACH", "JULIO", "TEAM_FORTIA"]

export const MODALIDAD_LABELS: Record<Modalidad, string> = {
  ELITE_ATHLETE: "Elite Athlete",
  ELITE_ATHLETE_PAREJAS: "Elite Athlete Parejas",
}

export const TARIFA_LABELS: Record<Tarifa, string> = {
  OPENING: "Opening",
  REGULAR: "Regular",
  ANTERIOR: "Regular (tarifa anterior)",
  PERSONALIZADO: "Personalizado",
}

/**
 * Nombre del paquete EP como plan, para mostrarlo cuando el cliente no tiene un plan de la lista de
 * membresías (p. ej. paquetes personalizados): "Elite Athlete — Team Fortia — 6 sesiones (Personalizado)".
 */
export function trainingPlanName(p: { tipoEntrenador: string; modalidad: string; tarifa: string; numPacks: number; clasesPerPack: number }) {
  const parejas = p.modalidad === "ELITE_ATHLETE_PAREJAS"
  return [
    MODALIDAD_LABELS[p.modalidad as Modalidad] ?? p.modalidad,
    ENTRENADOR_LABELS[p.tipoEntrenador as Entrenador] ?? p.tipoEntrenador,
    `${p.clasesPerPack} ${parejas ? "ses." : "sesiones"}${p.numPacks > 1 ? ` × ${p.numPacks} packs` : ""}${p.tarifa !== "REGULAR" ? ` (${TARIFA_LABELS[p.tarifa as Tarifa] ?? p.tarifa})` : ""}`,
  ].join(" — ")
}

/** Descripción del cobro de un paquete (misma que usa "Registrar pago → Entrenamiento Personal"). */
export function trainingDescription(p: { tipoEntrenador: string; modalidad: string; tarifa: string; numPacks: number; clasesPerPack: number }, clientName: string) {
  return [
    ENTRENADOR_LABELS[p.tipoEntrenador as Entrenador] ?? p.tipoEntrenador,
    MODALIDAD_LABELS[p.modalidad as Modalidad] ?? p.modalidad,
    TARIFA_LABELS[p.tarifa as Tarifa] ?? p.tarifa,
    `${p.numPacks} pack${p.numPacks > 1 ? "s" : ""}`,
    `${p.clasesPerPack} clases`,
    `— ${clientName}`,
  ].join(" · ")
}
