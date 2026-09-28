import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, str } from "@/lib/coaching/auth"
import { notifyClient } from "@/lib/coaching/notify"

type Params = { params: Promise<{ id: string }> }

/** El entrenador marca el check-in como revisado y (opcional) responde. */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const body = await request.json()
  const coachReply = str(body.coachReply)
  const checkIn = await prisma.checkIn.update({
    where: { id },
    data: { coachReply, reviewedAt: new Date() },
  })
  if (coachReply) {
    await notifyClient(checkIn.clientId, { type: "CHECKIN", title: "Tu coach revisó tu check-in", body: coachReply.slice(0, 120), link: "/app/checkin" })
  }
  return NextResponse.json(checkIn)
}
