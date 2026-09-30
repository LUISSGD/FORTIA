import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import { MUSCLE_GROUPS, embedUrl, techniqueSearchUrl } from "@/lib/coaching/constants"
import { formatYmd } from "@/lib/coaching/dates"
import { estimate1RM, formatSet, fmtKg } from "@/lib/coaching/workout"
import { Card, PageTitle, SectionTitle } from "@/components/coaching/app/ui"
import LineChartCard from "@/components/coaching/LineChartCard"

export default async function ExerciseDetail({ params }: PageProps<"/app/training/exercise/[id]">) {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const { id } = await params
  const [exercise, logs] = await Promise.all([
    prisma.exercise.findUnique({ where: { id } }),
    prisma.workoutLog.findMany({
      where: { clientId: ctx.clientId, completedAt: { not: null }, sets: { some: { exerciseId: id } } },
      orderBy: { startedAt: "asc" },
      include: { sets: { where: { exerciseId: id }, orderBy: { setNumber: "asc" } } },
    }),
  ])
  if (!exercise) notFound()
  const embed = embedUrl(exercise.videoUrl)
  const points = logs.map((l) => ({ label: formatYmd(l.date), value: Math.round(Math.max(...l.sets.map((s) => estimate1RM(s.weight ?? 0, s.reps ?? 0))) * 10) / 10 }))
  const best = Math.max(0, ...points.map((p) => p.value))

  return (
    <div className="space-y-4">
      <PageTitle title={exercise.name} subtitle={[MUSCLE_GROUPS[exercise.muscleGroup], exercise.equipment].filter(Boolean).join(" · ")} back="/app/training" />
      {embed ? (
        <iframe src={embed} className="w-full aspect-video rounded-2xl" allowFullScreen title={exercise.name} />
      ) : exercise.videoUrl ? (
        <a href={exercise.videoUrl} target="_blank" rel="noreferrer" className="block rounded-2xl bg-gray-50 border border-gray-200 p-4 text-center font-semibold text-orange-500">🎥 Ver video</a>
      ) : (
        <a href={techniqueSearchUrl(exercise.name)} target="_blank" rel="noreferrer" className="block rounded-2xl bg-gray-50 border border-gray-200 p-4 text-center text-sm text-gray-400">🎥 Ver ejemplos de técnica</a>
      )}
      {exercise.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={exercise.imageUrl} alt={exercise.name} className="w-full rounded-2xl" />
      )}
      <Card>
        <SectionTitle emoji="💪">Músculos</SectionTitle>
        <p className="text-sm"><b>{exercise.primaryMuscle}</b>{exercise.secondaryMuscles ? <span className="text-gray-400"> · {exercise.secondaryMuscles}</span> : null}</p>
      </Card>
      {exercise.instructions && (
        <Card>
          <SectionTitle emoji="✅">Cómo hacerlo</SectionTitle>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{exercise.instructions}</p>
        </Card>
      )}
      {exercise.commonMistakes && (
        <Card className="border-red-500/30">
          <SectionTitle emoji="⚠️">Errores comunes</SectionTitle>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{exercise.commonMistakes}</p>
        </Card>
      )}
      <Card>
        <SectionTitle emoji="📈" action={best ? <span className="text-xs text-orange-500">Mejor 1RM est.: {fmtKg(best)} kg</span> : null}>Tu rendimiento</SectionTitle>
        <LineChartCard data={points} unit="kg" height={180} />
        <ul className="mt-3 space-y-2">
          {[...logs].reverse().slice(0, 8).map((l) => (
            <li key={l.id} className="text-sm">
              <p className="text-xs text-gray-400">{formatYmd(l.date, true)}</p>
              <p>{l.sets.map(formatSet).join(" · ")}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
