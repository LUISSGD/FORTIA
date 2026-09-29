import { NextResponse } from "next/server"
import { requireClient, jsonError } from "@/lib/coaching/auth"
import { getPersonalTraining, registerClientSession, undoClientSession } from "@/lib/coaching/personal-training"

export async function GET() {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  return NextResponse.json(await getPersonalTraining(guard.clientId))
}

/** Registra que hoy asistió a su clase personalizada. */
export async function POST() {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const r = await registerClientSession(guard.clientId)
  if ("error" in r) return jsonError(r.error)
  return NextResponse.json({ ...r, plan: await getPersonalTraining(guard.clientId) })
}

/** Deshace el registro de hoy. */
export async function DELETE() {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const r = await undoClientSession(guard.clientId)
  if ("error" in r) return jsonError(r.error as string)
  return NextResponse.json({ ok: true, plan: await getPersonalTraining(guard.clientId) })
}
