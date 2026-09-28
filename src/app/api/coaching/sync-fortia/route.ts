import { NextResponse } from "next/server"
import { requireCoach, jsonError } from "@/lib/coaching/auth"
import { syncCandidates, syncFromFortia } from "@/lib/coaching/sync-fortia"

export const maxDuration = 60

export async function GET() {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  return NextResponse.json(await syncCandidates())
}

/** Body: { clientIds: string[] } */
export async function POST(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const body = await request.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body.clientIds) ? body.clientIds.filter((x: unknown) => typeof x === "string") : []
  if (!ids.length) return jsonError("Selecciona al menos un cliente")
  if (ids.length > 150) return jsonError("Máximo 150 clientes por vez")
  return NextResponse.json(await syncFromFortia(ids))
}
