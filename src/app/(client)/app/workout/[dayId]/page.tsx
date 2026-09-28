import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import { embedUrl, techniqueSearchUrl } from "@/lib/coaching/constants"
import { estimate1RM } from "@/lib/coaching/workout"
import WorkoutPlayer from "@/components/coaching/app/WorkoutPlayer"

export default async function WorkoutPage({ params }: PageProps<"/app/workout/[dayId]">) {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const { dayId } = await params
  const day = await prisma.programDay.findFirst({
    where: { id: dayId, program: { clientId: ctx.clientId } },
    include: { program: { include: { days: { select: { id: true } } } }, exercises: { orderBy: { order: "asc" }, include: { exercise: true } } },
  })
  if (!day) notFound()

  const exerciseIds = [...new Set(day.exercises.map((e) => e.exerciseId))]
  const [lastSets, bests, doneInProgram] = await Promise.all([
    Promise.all(
      exerciseIds.map(async (exerciseId) => {
        const last = await prisma.workoutLog.findFirst({
          where: { clientId: ctx.clientId, completedAt: { not: null }, sets: { some: { exerciseId } } },
          orderBy: { startedAt: "desc" },
          include: { sets: { where: { exerciseId }, orderBy: { setNumber: "asc" } } },
        })
        return [exerciseId, last?.sets.map((s) => ({ weight: s.weight, reps: s.reps })) ?? []] as const
      })
    ),
    prisma.setLog.findMany({ where: { exerciseId: { in: exerciseIds }, workoutLog: { clientId: ctx.clientId } }, select: { exerciseId: true, weight: true, reps: true } }),
    prisma.workoutLog.count({ where: { clientId: ctx.clientId, completedAt: { not: null }, programDayId: { in: day.program.days.map((d) => d.id) } } }),
  ])
  const previous = Object.fromEntries(lastSets)
  const best: Record<string, number> = {}
  bests.forEach((s) => { best[s.exerciseId] = Math.max(best[s.exerciseId] ?? 0, estimate1RM(s.weight ?? 0, s.reps ?? 0)) })
  const dayIndex = day.program.days.findIndex((d) => d.id === day.id) + 1
  const week = Math.floor(doneInProgram / Math.max(1, day.program.days.length)) + 1

  return (
    <WorkoutPlayer
      dayId={day.id}
      title={day.name}
      subtitle={`Semana ${week} / Día ${dayIndex}`}
      notes={day.notes}
      exercises={day.exercises.map((e) => ({
        id: e.id,
        exerciseId: e.exerciseId,
        name: e.exercise.name,
        sets: e.sets,
        reps: e.reps,
        restSec: e.restSec,
        rir: e.rir,
        tempo: e.tempo,
        load: e.load,
        notes: e.notes,
        videoEmbed: embedUrl(e.exercise.videoUrl),
        videoUrl: e.exercise.videoUrl ?? techniqueSearchUrl(e.exercise.name),
        instructions: e.exercise.instructions,
        previous: previous[e.exerciseId] ?? [],
        best1RM: best[e.exerciseId] ?? 0,
      }))}
    />
  )
}
