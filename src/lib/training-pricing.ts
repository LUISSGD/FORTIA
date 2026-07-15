export type Entrenador = "HEAD_COACH" | "TEAM_FORTIA"
export type Modalidad = "ELITE_ATHLETE" | "ELITE_ATHLETE_PAREJAS"
export type Tarifa = "OPENING" | "REGULAR"
export type NumPacks = 1 | 3 | 6
export type ClasesPerPack = 8 | 12 | 16

type PriceMap = Partial<Record<NumPacks, Partial<Record<ClasesPerPack, number>>>>
type TarifaMap = Partial<Record<Tarifa, PriceMap>>
type ModalidadMap = Partial<Record<Modalidad, TarifaMap>>
type EntrenadorMap = Partial<Record<Entrenador, ModalidadMap>>

export const TRAINING_PRICING: EntrenadorMap = {
  HEAD_COACH: {
    ELITE_ATHLETE_PAREJAS: {
      OPENING: {
        1: { 8: 1050, 12: 1200, 16: 1520 },
        3: { 8: 3000, 12: 3500, 16: 4300 },
        6: { 8: 5600, 12: 6600, 16: 8400 },
      },
      REGULAR: {
        1: { 8: 1200, 12: 1440, 16: 1760 },
        3: { 8: 3300, 12: 4000, 16: 4920 },
        6: { 8: 6000, 12: 7560, 16: 9400 },
      },
    },
  },
  TEAM_FORTIA: {
    ELITE_ATHLETE: {
      REGULAR: {
        1: { 8: 840, 12: 1050, 16: 1350 },
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
  TEAM_FORTIA: "Team Fortia",
}

export const MODALIDAD_LABELS: Record<Modalidad, string> = {
  ELITE_ATHLETE: "Elite Athlete",
  ELITE_ATHLETE_PAREJAS: "Elite Athlete Parejas",
}

export const TARIFA_LABELS: Record<Tarifa, string> = {
  OPENING: "Opening",
  REGULAR: "Regular",
}
