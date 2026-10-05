import { NextResponse } from "next/server"
import { requireCoachOrTrainer, jsonError, str } from "@/lib/coaching/auth"
import { notifyClient } from "@/lib/coaching/notify"
import { copyProgram } from "../../shared"

type Params = { params: Promise<{ id: string }> }

/** Asigna una plantilla a uno o varios clientes (copia independiente para cada uno). */
export async function POST(request: Request, { params }: Params) {
  const guard = await requireCoachOrTrainer()
  if ("error" in guard) return guard.error
  const { id } = await params
  const body = await request.json()
  const clientIds: string[] = Array.isArray(body.clientIds) ? body.clientIds : [str(body.clientId)].filter(Boolean) as string[]
  if (!clientIds.length) return jsonError("Selecciona al menos un cliente")

  const created = []
  for (const clientId of clientIds) {
    const program = await copyProgram(id, { clientId, isTemplate: false })
    if (!program) return jsonError("Programa no encontrado", 404)
    await notifyClient(clientId, { type: "WORKOUT", title: "Nuevo programa de entrenamiento", body: program.name, link: "/app/training" })
    created.push(program)
  }
  return NextResponse.json(created, { status: 201 })
}
