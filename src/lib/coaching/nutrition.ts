export type Macros = { kcal: number; protein: number; carbs: number; fat: number }

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

type ItemLike = {
  grams: number
  kcal?: number | null
  protein?: number | null
  carbs?: number | null
  fat?: number | null
  food?: { kcal: number; protein: number; carbs: number; fat: number } | null
}

/** Macros de un item: si viene de biblioteca, se calcula por gramos (valores por 100 g). */
export function itemMacros(item: ItemLike): Macros {
  if (item.food) {
    const f = item.grams / 100
    return {
      kcal: item.food.kcal * f,
      protein: item.food.protein * f,
      carbs: item.food.carbs * f,
      fat: item.food.fat * f,
    }
  }
  return {
    kcal: item.kcal ?? 0,
    protein: item.protein ?? 0,
    carbs: item.carbs ?? 0,
    fat: item.fat ?? 0,
  }
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
    { ...ZERO }
  )
}

export function optionMacros(option: { items: ItemLike[] }): Macros {
  return sumMacros(option.items.map(itemMacros))
}

export function roundMacros(m: Macros): Macros {
  return { kcal: Math.round(m.kcal), protein: Math.round(m.protein), carbs: Math.round(m.carbs), fat: Math.round(m.fat) }
}

/** Texto amigable para la cantidad: "3 unidades (150 g)" o "180 g". */
export function quantityLabel(grams: number, food?: { unitName: string | null; unitGrams: number | null } | null) {
  if (food?.unitName && food.unitGrams) {
    const units = grams / food.unitGrams
    const rounded = Math.round(units * 2) / 2
    if (Math.abs(units - rounded) < 0.05 && rounded > 0) {
      const name = rounded === 1 ? food.unitName : pluralize(food.unitName)
      return `${rounded} ${name} (${Math.round(grams)} g)`
    }
  }
  return `${Math.round(grams)} g`
}

function pluralize(w: string): string {
  if (w.includes(" ")) {
    const [first, ...rest] = w.split(" ")
    return [pluralize(first), ...rest].join(" ")
  }
  return /[aeiouáéó]$/i.test(w) ? `${w}s` : `${w}es`
}

/** Mifflin-St Jeor → kcal de mantenimiento aproximadas. */
export function estimateTdee(p: { weight?: number | null; heightCm?: number | null; age?: number | null; sex?: string | null; trainingDays?: number | null }) {
  if (!p.weight || !p.heightCm || !p.age) return null
  const bmr = 10 * p.weight + 6.25 * p.heightCm - 5 * p.age + (p.sex === "F" ? -161 : 5)
  const days = p.trainingDays ?? 3
  const factor = days >= 6 ? 1.725 : days >= 4 ? 1.55 : days >= 2 ? 1.375 : 1.2
  return Math.round(bmr * factor)
}
