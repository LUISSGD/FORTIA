import { prisma } from "@/lib/prisma"

const TX_OPTS = { timeout: 30_000, maxWait: 10_000 }
import { num, str } from "@/lib/coaching/auth"
import type { Prisma } from "@/generated/prisma/client"

export const programInclude = {
  days: {
    orderBy: { order: "asc" },
    include: { exercises: { orderBy: { order: "asc" }, include: { exercise: true } } },
  },
} satisfies Prisma.ProgramInclude

type ExerciseInput = { exerciseId: string; sets?: unknown; reps?: unknown; restSec?: unknown; rir?: unknown; tempo?: unknown; load?: unknown; notes?: unknown }
type DayInput = { id?: string; name?: unknown; dayOfWeek?: unknown; notes?: unknown; exercises?: ExerciseInput[] }

function exerciseRows(list: ExerciseInput[] = []) {
  return list
    .filter((e) => e.exerciseId)
    .map((e, i) => ({
      exerciseId: e.exerciseId,
      order: i,
      sets: Math.max(1, Math.round(num(e.sets) ?? 3)),
      reps: str(e.reps) ?? "8-10",
      restSec: Math.max(0, Math.round(num(e.restSec) ?? 90)),
      rir: str(e.rir),
      tempo: str(e.tempo),
      load: str(e.load),
      notes: str(e.notes),
    }))
}

/** Guarda la estructura completa del programa conservando los IDs de días existentes (el historial queda vinculado). */
export async function saveProgramDays(programId: string, days: DayInput[]) {
  const current = await prisma.programDay.findMany({ where: { programId }, select: { id: true } })
  const keepIds = new Set(days.map((d) => d.id).filter(Boolean) as string[])
  await prisma.$transaction(async (tx) => {
    await tx.programDay.deleteMany({ where: { programId, id: { in: current.map((c) => c.id).filter((id) => !keepIds.has(id)) } } })
    for (const [i, d] of days.entries()) {
      const dayData = {
        name: str(d.name) ?? `Día ${i + 1}`,
        order: i,
        dayOfWeek: d.dayOfWeek === null || d.dayOfWeek === "" || d.dayOfWeek === undefined ? null : Number(d.dayOfWeek),
        notes: str(d.notes),
      }
      let dayId = d.id && current.some((c) => c.id === d.id) ? d.id : null
      if (dayId) {
        await tx.programDay.update({ where: { id: dayId }, data: dayData })
        await tx.programExercise.deleteMany({ where: { dayId } })
      } else {
        dayId = (await tx.programDay.create({ data: { ...dayData, programId } })).id
      }
      const rows = exerciseRows(d.exercises)
      if (rows.length) await tx.programExercise.createMany({ data: rows.map((r) => ({ ...r, dayId: dayId! })) })
    }
  }, TX_OPTS)
}

/** Copia profunda de un programa (plantilla → cliente, o duplicado). */
export async function copyProgram(sourceId: string, target: { clientId: string | null; isTemplate: boolean; name?: string }) {
  const src = await prisma.program.findUnique({ where: { id: sourceId }, include: programInclude })
  if (!src) return null
  return prisma.$transaction(async (tx) => {
    if (target.clientId) {
      await tx.program.updateMany({ where: { clientId: target.clientId, isActive: true }, data: { isActive: false } })
    }
    const program = await tx.program.create({
      data: {
        name: target.name ?? src.name,
        goal: src.goal,
        level: src.level,
        description: src.description,
        weeks: src.weeks,
        isTemplate: target.isTemplate,
        clientId: target.clientId,
        isActive: true,
        startDate: target.clientId ? new Date() : null,
      },
    })
    for (const d of src.days) {
      const day = await tx.programDay.create({ data: { programId: program.id, name: d.name, order: d.order, dayOfWeek: d.dayOfWeek, notes: d.notes } })
      if (d.exercises.length) {
        await tx.programExercise.createMany({
          data: d.exercises.map((e) => ({
            dayId: day.id, exerciseId: e.exerciseId, order: e.order, sets: e.sets, reps: e.reps, restSec: e.restSec, rir: e.rir, tempo: e.tempo, load: e.load, notes: e.notes,
          })),
        })
      }
    }
    return program
  }, TX_OPTS)
}
