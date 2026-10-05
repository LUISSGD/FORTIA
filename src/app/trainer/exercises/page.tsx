import { prisma } from "@/lib/prisma"
import { requireTrainerPage } from "@/lib/coaching/auth"
import { withCoachErrors } from "@/components/coaching/withCoachErrors"
import ExerciseLibrary from "@/components/coaching/ExerciseLibrary"

export const dynamic = "force-dynamic"

async function TrainerExercisesPage() {
  await requireTrainerPage()
  const exercises = await prisma.exercise.findMany({ where: { isActive: true }, orderBy: [{ muscleGroup: "asc" }, { name: "asc" }] })
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <ExerciseLibrary exercises={exercises.map((e) => ({ ...e, createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString() }))} />
    </div>
  )
}

export default withCoachErrors("Ejercicios", TrainerExercisesPage)
