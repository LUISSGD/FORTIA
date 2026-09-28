export const MUSCLE_GROUPS: Record<string, string> = {
  PECHO: "Pecho",
  ESPALDA: "Espalda",
  HOMBROS: "Hombros",
  BRAZOS: "Brazos",
  PIERNAS: "Piernas",
  GLUTEOS: "Glúteos",
  CORE: "Core",
  CARDIO: "Cardio",
  FULLBODY: "Full body",
}

export const LEVELS: Record<string, string> = {
  PRINCIPIANTE: "Principiante",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
}

export const GOALS = [
  "Perder grasa",
  "Ganar músculo",
  "Recomposición corporal",
  "Hipertrofia",
  "Fuerza",
  "Salud y bienestar",
  "Rendimiento deportivo",
]

export const FOOD_CATEGORIES: Record<string, string> = {
  PROTEINAS: "Proteínas",
  CARBOHIDRATOS: "Carbohidratos",
  FRUTAS: "Frutas",
  VERDURAS: "Verduras",
  LACTEOS: "Lácteos",
  GRASAS: "Grasas",
  BEBIDAS: "Bebidas",
  SNACKS: "Snacks",
  OTROS: "Otros",
}

export const ENERGY_OPTIONS = [
  { value: 1, label: "Muy baja", emoji: "😫" },
  { value: 2, label: "Baja", emoji: "😕" },
  { value: 3, label: "Normal", emoji: "😐" },
  { value: 4, label: "Buena", emoji: "🙂" },
  { value: 5, label: "Excelente", emoji: "🔥" },
]

export const ADHERENCE_OPTIONS = [
  { value: "<50", label: "Menos del 50%" },
  { value: "50-70", label: "50 – 70%" },
  { value: "70-90", label: "70 – 90%" },
  { value: ">90", label: "Más del 90%" },
]

export const SLEEP_OPTIONS = [
  { value: "<5", label: "Menos de 5 h" },
  { value: "5-6", label: "5 – 6 h" },
  { value: "6-7", label: "6 – 7 h" },
  { value: "7-8", label: "7 – 8 h" },
  { value: ">8", label: "Más de 8 h" },
]

export const PHOTO_POSES: Record<string, string> = {
  FRENTE: "Frente",
  PERFIL: "Perfil",
  ESPALDA: "Espalda",
}

export const DOC_CATEGORIES: Record<string, string> = {
  GENERAL: "General",
  EVALUACION: "Evaluación",
  NUTRICION: "Alimentación",
  TECNICA: "Técnica",
  REGLAMENTO: "Reglamento",
  RECOMENDACIONES: "Recomendaciones",
}

export const CHALLENGE_METRICS: Record<string, string> = {
  WORKOUTS: "Entrenamientos completados",
  ACTIVE_DAYS: "Días cumplidos (entreno o dieta)",
  WATER_DAYS: "Días con meta de agua",
  MEALS: "Comidas registradas",
}

export const PROFILE_STATUS: Record<string, string> = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  ENDED: "Finalizado",
}

export const BOOKING_STATUS: Record<string, string> = {
  BOOKED: "Reservado",
  WAITLIST: "Lista de espera",
  CANCELLED: "Cancelado",
  ATTENDED: "Asistió",
  NO_SHOW: "No asistió",
}

/** Convierte un enlace de YouTube/Vimeo en URL embebible; otros enlaces se devuelven tal cual. */
export function embedUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}

export function techniqueSearchUrl(name: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} técnica correcta`)}`
}
