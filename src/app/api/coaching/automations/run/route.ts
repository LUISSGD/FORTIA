import { NextResponse } from "next/server"
import { requireCoach, jsonError } from "@/lib/coaching/auth"
import { runAutomations } from "@/lib/coaching/automations"
import { sendDigest } from "@/lib/coaching/digest"

export const maxDuration = 60

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
  // El resumen de la mañana va por separado: si una parte falla, la otra se envía igual
  const automations = await runAutomations().catch((e) => {
    console.error("[cron] automatizaciones", e)
    return { error: "automations" }
  })
  const digest = await sendDigest().catch((e) => {
    console.error("[cron] resumen", e)
    return { sent: false }
  })
  return NextResponse.json({ ...automations, digest })
}
