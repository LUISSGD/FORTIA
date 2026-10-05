import { prisma } from "@/lib/prisma"
import ExerciseLibrary from "@/components/coaching/ExerciseLibrary"

export const dynamic = "force-dynamic"

export default async function ExercisesPage() {
  const exercises = await prisma.exercise.findMany({ where: { isActive: true }, orderBy: [{ muscleGroup: "asc" }, { name: "asc" }] })
  return <ExerciseLibrary exercises={exercises.map((e) => ({ ...e, createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString() }))} />
}
