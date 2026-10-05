import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoachOrTrainer } from "@/lib/coaching/auth"
import { DEFAULT_EXERCISES } from "@/lib/coaching/library-exercises"
import { DEFAULT_FOODS } from "@/lib/coaching/library-foods"

/** Carga (o completa) la biblioteca base de ejercicios y alimentos. No sobrescribe lo existente. */
export async function POST() {
  const guard = await requireCoachOrTrainer()
  if ("error" in guard) return guard.error
  const [exercises, foods] = await Promise.all([
    prisma.exercise.createMany({ data: DEFAULT_EXERCISES, skipDuplicates: true }),
    prisma.food.createMany({ data: DEFAULT_FOODS, skipDuplicates: true }),
  ])
  return NextResponse.json({ exercises: exercises.count, foods: foods.count })
}
