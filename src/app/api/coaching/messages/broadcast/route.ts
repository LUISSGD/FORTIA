import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError, str } from "@/lib/coaching/auth"
import { fillTemplate, sendCoachMessage } from "@/lib/coaching/notify"

/** Mensaje masivo: a todos los clientes activos o a una selección. Admite {nombre}. */
export async function POST(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const body = await request.json()
  const text = str(body.body)
  if (!text) return jsonError("Mensaje vacío")
  const ids: string[] | null = Array.isArray(body.clientIds) && body.clientIds.length ? body.clientIds : null
  const profiles = await prisma.coachingProfile.findMany({
    where: { status: "ACTIVE", ...(ids ? { clientId: { in: ids } } : {}) },
    include: { client: { select: { firstName: true } } },
  })
  for (const p of profiles) await sendCoachMessage(p.clientId, fillTemplate(text, { nombre: p.client.firstName }))
  return NextResponse.json({ sent: profiles.length })
}
