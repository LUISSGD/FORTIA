import { num, str } from "@/lib/coaching/auth"

export function foodData(body: Record<string, unknown>) {
  return {
    name: str(body.name) ?? "",
    category: str(body.category) ?? "OTROS",
    kcal: num(body.kcal) ?? 0,
    protein: num(body.protein) ?? 0,
    carbs: num(body.carbs) ?? 0,
    fat: num(body.fat) ?? 0,
    unitName: str(body.unitName),
    unitGrams: num(body.unitGrams),
  }
}
