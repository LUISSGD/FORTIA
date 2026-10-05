import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import ProgramBuilder from "./ProgramBuilder"

/** Carga un programa (plantilla o de un cliente) y abre el editor. Compartido por /coaching y /trainer. */
export default async function ProgramEditor({ id, basePath }: { id: string; basePath: "/coaching" | "/trainer" }) {
  const [program, exercises, clients] = await Promise.all([
    prisma.program.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        days: { orderBy: { order: "asc" }, include: { exercises: { orderBy: { order: "asc" } } } },
      },
    }),
    prisma.exercise.findMany({ where: { isActive: true }, orderBy: [{ muscleGroup: "asc" }, { name: "asc" }], select: { id: true, name: true, muscleGroup: true, equipment: true } }),
    prisma.coachingProfile.findMany({ where: { status: "ACTIVE" }, select: { client: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { client: { firstName: "asc" } } }),
  ])
  if (!program) notFound()

  return (
    <ProgramBuilder
      basePath={basePath}
      program={{
        id: program.id,
        name: program.name,
        goal: program.goal ?? "",
        level: program.level ?? "",
        description: program.description ?? "",
        weeks: program.weeks,
        isTemplate: program.isTemplate,
        isActive: program.isActive,
        client: program.client ? { id: program.client.id, name: `${program.client.firstName} ${program.client.lastName}` } : null,
        days: program.days.map((d) => ({
          id: d.id,
          key: d.id,
          name: d.name,
          dayOfWeek: d.dayOfWeek === null ? "" : String(d.dayOfWeek),
          notes: d.notes ?? "",
          exercises: d.exercises.map((e) => ({
            key: e.id,
            exerciseId: e.exerciseId,
            sets: String(e.sets),
            reps: e.reps,
            restSec: String(e.restSec),
            rir: e.rir ?? "",
            tempo: e.tempo ?? "",
            load: e.load ?? "",
            notes: e.notes ?? "",
          })),
        })),
      }}
      exercises={exercises}
      clients={clients.map((c) => ({ id: c.client.id, name: `${c.client.firstName} ${c.client.lastName}` }))}
    />
  )
}
