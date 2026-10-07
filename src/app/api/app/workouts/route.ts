import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireClient, jsonError } from "@/lib/coaching/auth"
import { saveWorkout } from "@/lib/coaching/save-workout"
import { notifyCoach } from "@/lib/coaching/notify"
import { checkWeekCompleted } from "@/lib/coaching/automations"

/** Guarda un entrenamiento completo al terminar la sesión. */
export async function POST(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const { clientId } = guard
  const body = await request.json()

  const r = await saveWorkout(clientId, body)
  if ("error" in r) return jsonError(r.error ?? "Error", r.status ?? 400)
  const { workout, dayName } = r
  if (r.retry) return NextResponse.json(workout, { status: 200 })

  // Avisos al coach y automatizaciones: si fallan, el entrenamiento ya quedó guardado
  try {
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
  } catch (e) {
    console.error("Avisos tras entrenamiento:", e)
  }

  return NextResponse.json(workout, { status: 201 })
}
