import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoachOrTrainer, jsonError } from "@/lib/coaching/auth"
import { saveWorkout } from "@/lib/coaching/save-workout"
import { notifyClient } from "@/lib/coaching/notify"
import { checkWeekCompleted } from "@/lib/coaching/automations"

type Params = { params: Promise<{ id: string }> }

/** El entrenador registra el entrenamiento que hizo el cliente en su clase (queda en el historial del cliente). */
export async function POST(request: Request, { params }: Params) {
  const guard = await requireCoachOrTrainer()
  if ("error" in guard) return guard.error
  const { id: clientId } = await params
  if (!(await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }))) return jsonError("Cliente no encontrado", 404)

  const body = await request.json()
  const r = await saveWorkout(clientId, body)
  if ("error" in r) return jsonError(r.error ?? "Error", r.status ?? 400)
  if (r.retry) return NextResponse.json(r.workout, { status: 200 })

  try {
    const coach = guard.session.user?.name?.split(" ")[0] ?? "Tu entrenador"
    await notifyClient(clientId, {
      type: "WORKOUT",
      title: `💪 ${coach} registró tu entrenamiento`,
      body: `${r.dayName} · ${r.workout.volumeKg.toLocaleString("es-PE")} kg. Míralo en tu historial.`,
      link: "/app/training",
    })
    await checkWeekCompleted(clientId)
  } catch (e) {
    console.error("Avisos tras entrenamiento (entrenador):", e)
  }
  return NextResponse.json(r.workout, { status: 201 })
}
