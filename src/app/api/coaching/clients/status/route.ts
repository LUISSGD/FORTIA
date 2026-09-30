import { NextResponse } from "next/server"
import { setCoachingStatus } from "@/lib/coaching/lifecycle"
import { requireCoach, jsonError } from "@/lib/coaching/auth"

const ALLOWED = ["ACTIVE", "PAUSED", "STANDBY"]

/** Cambia el estado de varios clientes a la vez (activo, pausado o stand-by). */
export async function POST(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body.clientIds) ? body.clientIds.filter((x: unknown): x is string => typeof x === "string") : []
  if (!ids.length) return jsonError("Selecciona al menos un cliente")
  if (!ALLOWED.includes(body.status)) return jsonError("Estado no válido")
  // Stand-by también marca al cliente como inactivo en FORTIA (y reactivar lo vuelve a activar).
  const updated = await setCoachingStatus(ids, body.status)
  return NextResponse.json({ updated })
}
