import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { formatYmd } from "@/lib/coaching/dates"
import { formatSet } from "@/lib/coaching/workout"
import { Panel } from "@/components/coaching/kit"
import AssignPlan from "./AssignPlan"
import ExerciseProgression from "./ExerciseProgression"

/**
 * Pestaña "Entrenamiento" de la ficha del cliente: programa actual, asignación de rutina,
 * progresión por ejercicio e historial. Compartida por el coach (/coaching) y el entrenador (/trainer).
 */
export default async function TrainingTab({ clientId, basePath }: { clientId: string; basePath: "/coaching" | "/trainer" }) {
  const [programs, templates, workouts] = await Promise.all([
    prisma.program.findMany({ where: { clientId }, orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }], include: { days: { orderBy: { order: "asc" }, include: { _count: { select: { exercises: true } } } } } }),
    prisma.program.findMany({ where: { isTemplate: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.workoutLog.findMany({
      where: { clientId, completedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 60,
      include: { sets: { orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }], include: { exercise: { select: { id: true, name: true } } } } },
    }),
  ])
  const active = programs.find((p) => p.isActive)

  // Progresión por ejercicio (orden cronológico)
  const byExercise = new Map<string, { name: string; sessions: { date: string; sets: { weight: number | null; reps: number | null }[] }[] }>()
  for (const w of [...workouts].reverse()) {
    const grouped = new Map<string, { weight: number | null; reps: number | null }[]>()
    w.sets.forEach((s) => {
      if (!byExercise.has(s.exerciseId)) byExercise.set(s.exerciseId, { name: s.exercise.name, sessions: [] })
      if (!grouped.has(s.exerciseId)) grouped.set(s.exerciseId, [])
      grouped.get(s.exerciseId)!.push({ weight: s.weight, reps: s.reps })
    })
    grouped.forEach((sets, exId) => byExercise.get(exId)!.sessions.push({ date: w.date, sets }))
  }
  const progression = [...byExercise.entries()].map(([exerciseId, v]) => ({ exerciseId, ...v })).sort((a, b) => b.sessions.length - a.sessions.length)

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="space-y-4">
        <Panel title="Programa actual">
          {active ? (
            <div className="space-y-2">
              <Link href={`${basePath}/programs/${active.id}`} className="font-semibold text-orange-600 hover:underline">{active.name}</Link>
              <ul className="text-sm space-y-1">
                {active.days.map((d) => (
                  <li key={d.id} className="flex justify-between"><span>{d.name}</span><span className="text-gray-400">{d._count.exercises} ejercicios</span></li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-2">Este cliente no tiene programa activo.</p>
          )}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <AssignPlan kind="program" clientId={clientId} templates={templates} basePath={basePath} />
          </div>
        </Panel>
        {programs.filter((p) => !p.isActive).length > 0 && (
          <Panel title="Programas anteriores">
            <ul className="text-sm space-y-1">
              {programs.filter((p) => !p.isActive).map((p) => (
                <li key={p.id}><Link href={`${basePath}/programs/${p.id}`} className="hover:text-orange-600">{p.name}</Link></li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
      <div className="lg:col-span-2 space-y-4">
        <Panel title="📈 Progresión por ejercicio">
          <ExerciseProgression data={progression} />
        </Panel>
        <Panel title={`Historial de entrenamientos (${workouts.length})`}>
          {workouts.length === 0 ? (
            <p className="text-sm text-gray-500">Aún no registra entrenamientos.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {workouts.map((w) => {
                const notes = (w.exerciseNotes ?? {}) as Record<string, string>
                const groups = new Map<string, { name: string; sets: typeof w.sets }>()
                w.sets.forEach((s) => {
                  if (!groups.has(s.exerciseId)) groups.set(s.exerciseId, { name: s.exercise.name, sets: [] })
                  groups.get(s.exerciseId)!.sets.push(s)
                })
                return (
                  <details key={w.id} className="py-2 group">
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                      <span className="text-sm font-medium">{w.dayName} <span className="text-gray-400 font-normal">· {formatYmd(w.date, true)}</span></span>
                      <span className="text-xs text-gray-500">
                        {w.durationMin} min · {w.volumeKg.toLocaleString("es-PE")} kg{w.rating ? ` · ${"⭐".repeat(w.rating)}` : ""}
                        {(w.notes || Object.values(notes).some(Boolean)) && " · 💬"}
                      </span>
                    </summary>
                    <div className="mt-2 space-y-2 pl-2">
                      {[...groups.entries()].map(([exId, g]) => (
                        <div key={exId} className="text-sm">
                          <p className="font-medium">{g.name}</p>
                          <p className="text-gray-600 text-xs">{g.sets.map((s) => formatSet(s)).join(" · ")}</p>
                          {notes[exId] && <p className="text-xs text-orange-700 bg-orange-50 rounded px-2 py-1 mt-1">💬 {notes[exId]}</p>}
                        </div>
                      ))}
                      {w.notes && <p className="text-xs bg-gray-50 rounded p-2">📝 {w.notes}</p>}
                    </div>
                  </details>
                )
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
