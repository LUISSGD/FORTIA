import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireClient, jsonError, num, str } from "@/lib/coaching/auth"
import { todayYmd } from "@/lib/coaching/dates"
import { setsVolume } from "@/lib/coaching/workout"
import { notifyCoach } from "@/lib/coaching/notify"
import { checkWeekCompleted } from "@/lib/coaching/automations"

type SetInput = { exerciseId: string; setNumber: number; weight?: unknown; reps?: unknown; rir?: unknown; completed?: boolean }

/** Guarda un entrenamiento completo al terminar la sesión. */
export async function POST(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const { clientId } = guard
  const body = await request.json()

  const programDayId = str(body.programDayId)
  let dayName = str(body.dayName) ?? "Entrenamiento libre"
  if (programDayId) {
    const day = await prisma.programDay.findFirst({ where: { id: programDayId, program: { clientId } }, select: { name: true } })
    if (!day) return jsonError("Día de programa inválido", 404)
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
  if (!sets.length) return jsonError("Registra al menos una serie")

  const validIds = new Set((await prisma.exercise.findMany({ where: { id: { in: [...new Set(sets.map((s) => s.exerciseId))] } }, select: { id: true } })).map((e) => e.id))
  const cleanSets = sets.filter((s) => validIds.has(s.exerciseId))

  const startedAt = body.startedAt ? new Date(body.startedAt) : new Date()
  const completedAt = new Date()
  const durationMin = Math.max(1, Math.min(600, Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000)))
  const rating = num(body.rating)

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
      exerciseNotes: body.exerciseNotes && typeof body.exerciseNotes === "object" ? body.exerciseNotes : undefined,
      sets: { create: cleanSets },
    },
  })

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { firstName: true, lastName: true } })
  const hasFeedback = workout.notes || (body.exerciseNotes && Object.values(body.exerciseNotes).some(Boolean))
  await notifyCoach({
    clientId,
    type: "WORKOUT",
    title: `${client?.firstName} completó ${dayName}`,
    body: `${workout.durationMin} min · ${workout.volumeKg.toLocaleString("es-PE")} kg${hasFeedback ? " · dejó comentarios" : ""}`,
    link: `/coaching/clients/${clientId}?tab=training`,
  })
  await checkWeekCompleted(clientId)

  return NextResponse.json(workout, { status: 201 })
}
