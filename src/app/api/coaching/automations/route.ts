import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, num, str } from "@/lib/coaching/auth"
import { ensureAutomationRules } from "@/lib/coaching/automations"

export async function GET() {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  return NextResponse.json(await ensureAutomationRules())
}

/** Body: { rules: [{ id, enabled, days, channel, message }] } */
export async function PUT(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const body = await request.json()
  const rules: Record<string, unknown>[] = Array.isArray(body.rules) ? body.rules : []
  for (const r of rules) {
    await prisma.automationRule.update({
      where: { id: String(r.id) },
      data: {
        enabled: Boolean(r.enabled),
        days: num(r.days),
        channel: r.channel === "CHAT" ? "CHAT" : "NOTIFICATION",
        ...(str(r.message) ? { message: str(r.message)! } : {}),
      },
    })
  }
  return NextResponse.json(await prisma.automationRule.findMany())
}
