import { NextResponse } from "next/server"
import { requireCoach, jsonError } from "@/lib/coaching/auth"
import { runAutomations } from "@/lib/coaching/automations"

/** Ejecución manual desde el panel. */
export async function POST() {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  return NextResponse.json(await runAutomations())
}

/** Ejecución programada (Vercel Cron) con `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return jsonError("No autorizado", 401)
  return NextResponse.json(await runAutomations())
}
