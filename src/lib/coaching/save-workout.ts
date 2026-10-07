import { prisma } from "@/lib/prisma"
import { num, str } from "./auth"
import { todayYmd } from "./dates"
import { setsVolume } from "./workout"

type SetInput = { exerciseId: string; setNumber: number; weight?: unknown; reps?: unknown; rir?: unknown; completed?: boolean }

/**
 * Guarda un entrenamiento completo del cliente (desde su app o registrado por el entrenador en la clase).
 * Devuelve el entrenamiento creado, el ya existente si es un reintento, o un error para el usuario.
 */
export async function saveWorkout(clientId: string, body: Record<string, unknown>) {
  const programDayId = str(body.programDayId)
  let dayName = str(body.dayName) ?? "Entrenamiento libre"
  if (programDayId) {
    const day = await prisma.programDay.findFirst({ where: { id: programDayId, program: { clientId } }, select: { name: true } })
    if (!day) return { error: "Día de programa inválido", status: 404 } as const
    dayName = day.name
  }

  const rawSets: SetInput[] = Array.isArray(body.sets) ? body.sets : []
  const sets = rawSets
    .filter((s) => s.exerciseId && (num(s.reps) || num(s.weight)))
    .map((s) => ({
      exerciseId: s.exerciseId,
      setNumber: Math.round(num(s.setNumber) ?? 1),
      weight: num(s.weight),
      reps: num(s.reps) === null ? null : Math.round(num(s.reps)!),
      rir: num(s.rir) === null ? null : Math.round(num(s.rir)!),
      completed: s.completed !== false,
    }))
  if (!sets.length) return { error: "Registra al menos una serie", status: 400 } as const

  const validIds = new Set((await prisma.exercise.findMany({ where: { id: { in: [...new Set(sets.map((s) => s.exerciseId))] } }, select: { id: true } })).map((e) => e.id))
  const cleanSets = sets.filter((s) => validIds.has(s.exerciseId))

  const parsedStart = typeof body.startedAt === "string" ? new Date(body.startedAt) : null
  const startedAt = parsedStart && !isNaN(parsedStart.getTime()) ? parsedStart : new Date()

  // Reintento del mismo entrenamiento (p. ej. se cortó la conexión tras guardar): no duplicar
  if (parsedStart) {
    const already = await prisma.workoutLog.findFirst({ where: { clientId, startedAt, programDayId: programDayId ?? undefined } })
    if (already) return { workout: already, dayName, retry: true } as const
  }

  const completedAt = new Date()
  const durationMin = Math.max(1, Math.min(600, Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000)))
  const rating = num(body.rating)

  try {
    const workout = await prisma.workoutLog.create({
      data: {
        clientId,
        programDayId,
        dayName,
        date: todayYmd(),
        startedAt,
        completedAt,
        durationMin,
        volumeKg: Math.round(setsVolume(cleanSets)),
        rating: rating === null ? null : Math.min(5, Math.max(1, Math.round(rating))),
        notes: str(body.notes),
        exerciseNotes: body.exerciseNotes && typeof body.exerciseNotes === "object" ? (body.exerciseNotes as object) : undefined,
        sets: { create: cleanSets },
      },
    })
    return { workout, dayName, retry: false } as const
  } catch (e) {
    console.error("Guardar entrenamiento:", e)
    return { error: "No se pudo guardar el entrenamiento. Intenta de nuevo.", status: 500 } as const
  }
}
