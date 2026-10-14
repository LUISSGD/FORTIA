// Entrenadores de las clases personalizadas (EP). Para agregar uno, súmalo aquí con su color.
// Se guarda en Client.trainer y pinta sus clases en la agenda de coaching.
export const TRAINERS = [
  { name: "Julio", card: "bg-violet-50 border-violet-200 hover:border-violet-400", text: "text-violet-700", sub: "text-violet-400", dot: "bg-violet-500", bar: "border-l-violet-500", pill: "bg-violet-100 text-violet-800" },
  { name: "Piero", card: "bg-emerald-50 border-emerald-200 hover:border-emerald-400", text: "text-emerald-700", sub: "text-emerald-500", dot: "bg-emerald-500", bar: "border-l-emerald-500", pill: "bg-emerald-100 text-emerald-800" },
] as const

const UNASSIGNED = { name: "Sin entrenador", card: "bg-sky-50 border-sky-200 hover:border-sky-400", text: "text-sky-700", sub: "text-sky-400", dot: "bg-sky-400", bar: "border-l-sky-400", pill: "bg-sky-100 text-sky-800" }

export function trainerStyle(trainer: string | null | undefined) {
  return TRAINERS.find((t) => t.name === trainer) ?? UNASSIGNED
}
export const UNASSIGNED_TRAINER = UNASSIGNED
