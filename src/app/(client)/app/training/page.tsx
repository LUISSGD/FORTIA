import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import { getTrainingState } from "@/lib/coaching/client-data"
import { formatYmd } from "@/lib/coaching/dates"
import { DAYS_OF_WEEK } from "@/lib/utils"
import { CTA, Card, PageTitle, SectionTitle } from "@/components/coaching/app/ui"

export default async function TrainingPage() {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const [{ program, nextDay, doneToday, week, dayIndex }, history] = await Promise.all([
    getTrainingState(ctx.clientId),
    prisma.workoutLog.findMany({ where: { clientId: ctx.clientId, completedAt: { not: null } }, orderBy: { startedAt: "desc" }, take: 10, include: { _count: { select: { sets: true } } } }),
  ])

  if (!program) {
    return (
      <>
        <PageTitle title="Entrenamiento" />
        <Card><p className="text-sm text-gray-400">Aún no tienes un programa asignado. Tu coach lo cargará pronto. 💪</p></Card>
      </>
    )
  }

  return (
    <div className="space-y-4">
      <PageTitle title={program.name} subtitle={`Semana ${week} de ${program.weeks} · ${program.days.length} días`} />
      {program.description && <Card className="text-sm text-gray-700 whitespace-pre-wrap">📋 {program.description}</Card>}

      {nextDay && (
        <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
          <p className="text-[11px] uppercase tracking-widest text-orange-500 font-bold">{doneToday ? "Siguiente sesión" : "Hoy toca"}</p>
          <p className="text-xl font-black text-gray-900">{nextDay.name}</p>
          <p className="text-xs text-gray-400 mb-3">Semana {week} / Día {dayIndex} · {nextDay.exercises.length} ejercicios</p>
          <CTA href={`/app/workout/${nextDay.id}`}>{doneToday ? "ENTRENAR DE NUEVO" : "EMPEZAR"}</CTA>
        </Card>
      )}

      <div>
        <SectionTitle emoji="🗓️">Tu programa</SectionTitle>
        <div className="space-y-3">
          {program.days.map((d, i) => (
            <Card key={d.id}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-bold text-gray-900">{d.name}</p>
                  <p className="text-[11px] text-gray-400">Día {i + 1}{d.dayOfWeek !== null ? ` · ${DAYS_OF_WEEK[d.dayOfWeek]}` : ""}</p>
                </div>
                <Link href={`/app/workout/${d.id}`} className="text-xs font-bold text-orange-500 border border-orange-200 rounded-lg px-3 py-1.5">Entrenar</Link>
              </div>
              <ul className="divide-y divide-gray-100">
                {d.exercises.map((e, j) => (
                  <li key={e.id}>
                    <Link href={`/app/training/exercise/${e.exerciseId}`} className="flex items-center justify-between py-2 text-sm text-gray-900">
                      <span><span className="text-gray-400 mr-2">{String(j + 1).padStart(2, "0")}</span>{e.exercise.name}</span>
                      <span className="text-gray-400 text-xs">{e.sets} × {e.reps}{e.rir ? ` · RIR ${e.rir}` : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {d.notes && <p className="text-xs text-gray-400 mt-2">📝 {d.notes}</p>}
            </Card>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle emoji="📜">Historial</SectionTitle>
        {history.length === 0 ? (
          <Card><p className="text-sm text-gray-400">Tus entrenamientos completados aparecerán aquí.</p></Card>
        ) : (
          <Card className="p-0 divide-y divide-gray-100">
            {history.map((w) => (
              <div key={w.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{w.dayName}</p>
                  <p className="text-xs text-gray-400">{formatYmd(w.date, true)}</p>
                </div>
                <p className="text-xs text-gray-400 text-right">{w.durationMin} min<br />{w.volumeKg.toLocaleString("es-PE")} kg · {w._count.sets} series</p>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}
