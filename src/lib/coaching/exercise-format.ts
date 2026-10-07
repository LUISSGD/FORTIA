// Lectura de la prescripción de un ejercicio tal como la escribe el coach (o como vino de Harbiz):
//   notas: "[FUERZA/RENDIMIENTO] SUPERSERIE A → Saltos laterales | Sé explosivo."
//   reps:  "12 a 10 RPE@8-9", "30 a 45 seg", "Mantener 45 segundos"

export type ExerciseNotes = {
  /** Bloque de la sesión: "Activación", "Fuerza"… */
  section: string | null
  /** Etiqueta de la superserie / circuito: "Superserie A" */
  superset: string | null
  /** Indicación del coach para el cliente */
  tip: string | null
}

const SECTION_RE = /^\s*\[([^\]]+)\]\s*/
const SUPERSET_RE = /^((?:superserie|biserie|triserie|circuito|giant set)\b[^→]*?)\s*→[^|]*(?:\|\s*([\s\S]*))?$/i

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s/:(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())

export function parseExerciseNotes(notes: string | null | undefined): ExerciseNotes {
  let rest = (notes ?? "").trim()
  let section: string | null = null
  const sec = rest.match(SECTION_RE)
  if (sec) {
    section = titleCase(sec[1].trim())
    rest = rest.slice(sec[0].length).trim()
  }
  let superset: string | null = null
  const ss = rest.match(SUPERSET_RE)
  if (ss) {
    superset = titleCase(ss[1].replace(/\s*\(\d+\s*ej\.?\)/i, "").trim())
    rest = (ss[2] ?? "").trim()
  }
  return { section, superset, tip: rest || null }
}

/** Separa el RPE de las repeticiones: "12 a 10 RPE@8-9" → { reps: "12 a 10", rpe: "8-9" } */
export function splitReps(reps: string): { reps: string; rpe: string | null } {
  const m = reps.match(/\s*RPE\s*@?\s*([\d.,]+(?:\s*-\s*[\d.,]+)?)/i)
  if (!m) return { reps: reps.trim(), rpe: null }
  return { reps: reps.replace(m[0], " ").replace(/\s+/g, " ").trim() || "-", rpe: m[1].replace(/\s+/g, "") }
}

/** Segundos de trabajo si la serie es por tiempo ("30 a 45 seg" → 30, "1 min" → 60); si no, null. */
export function timedSeconds(reps: string): number | null {
  const m = reps.match(/^\D*?(\d+)\s*(?:(?:-|a)\s*\d+\s*)?(seg|s\b|segundos|min)/i)
  if (!m) return null
  const n = Number(m[1]) * (/^min/i.test(m[2]) ? 60 : 1)
  return n > 0 && n <= 600 ? n : null
}

/** Rango de repeticiones objetivo: "12 a 10" → [10, 12]; "8" → [8, 8]; por tiempo o sin números → null. */
export function repRange(reps: string): [number, number] | null {
  if (timedSeconds(reps)) return null
  const nums = (splitReps(reps).reps.split("(")[0].match(/\d+/g) ?? []).map(Number).filter((n) => n > 0 && n < 100)
  return nums.length ? [Math.min(...nums), Math.max(...nums)] : null
}

/**
 * Doble progresión: si la última vez hizo el máximo del rango en todas las series con el mismo peso,
 * toca subir el peso (+2,5 kg, o +1 kg en pesos ligeros). Si no llegó al mínimo, mantener.
 */
export function progression(reps: string, previous: { weight: number | null; reps: number | null }[]): { up: boolean; weight: number } | null {
  const range = repRange(reps)
  const sets = previous.filter((p) => (p.weight ?? 0) > 0 && (p.reps ?? 0) > 0)
  if (!range || !sets.length) return null
  const top = Math.max(...sets.map((p) => p.weight!))
  const atTop = sets.filter((p) => p.weight === top)
  if (atTop.every((p) => p.reps! >= range[1])) return { up: true, weight: top + (top < 20 ? 1 : 2.5) }
  return { up: false, weight: top }
}
