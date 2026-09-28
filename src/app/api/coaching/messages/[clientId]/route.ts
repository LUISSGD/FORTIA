import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError, str } from "@/lib/coaching/auth"
import { sendCoachMessage } from "@/lib/coaching/notify"

type Params = { params: Promise<{ clientId: string }> }

export async function GET(_request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { clientId } = await params
  const [messages] = await Promise.all([
    prisma.coachMessage.findMany({ where: { clientId }, orderBy: { createdAt: "asc" }, take: 300 }),
    prisma.coachMessage.updateMany({ where: { clientId, sender: "CLIENT", readAt: null }, data: { readAt: new Date() } }),
  ])
  return NextResponse.json(messages)
}

export async function POST(request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { clientId } = await params
  const body = await request.json()
  const text = str(body.body) ?? ""
  const attachment = body.attachmentUrl ? { url: String(body.attachmentUrl), type: String(body.attachmentType ?? "FILE") } : null
  if (!text && !attachment) return jsonError("Mensaje vacío")
  return NextResponse.json(await sendCoachMessage(clientId, text, "COACH", attachment), { status: 201 })
}
