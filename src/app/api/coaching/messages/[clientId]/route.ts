import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoachOrTrainer, jsonError, str } from "@/lib/coaching/auth"
import { sendCoachMessage } from "@/lib/coaching/notify"

type Params = { params: Promise<{ clientId: string }> }

export async function GET(_request: Request, { params }: Params) {
  const guard = await requireCoachOrTrainer()
  if ("error" in guard) return guard.error
  const { clientId } = await params
  const [messages] = await Promise.all([
    prisma.coachMessage.findMany({ where: { clientId, channel: "COACHING" }, orderBy: { createdAt: "asc" }, take: 300 }),
    prisma.coachMessage.updateMany({ where: { clientId, channel: "COACHING", sender: "CLIENT", readAt: null }, data: { readAt: new Date() } }),
  ])
  return NextResponse.json(messages)
}

export async function POST(request: Request, { params }: Params) {
  const guard = await requireCoachOrTrainer()
  if ("error" in guard) return guard.error
  const { clientId } = await params
  const body = await request.json()
  const text = str(body.body) ?? ""
  const attachment = body.attachmentUrl ? { url: String(body.attachmentUrl), type: String(body.attachmentType ?? "FILE") } : null
  if (!text && !attachment) return jsonError("Mensaje vacío")
  const user = guard.session.user
  const author = user.id ? { id: user.id, name: user.name?.trim() || "Tu coach" } : null
  return NextResponse.json(await sendCoachMessage(clientId, text, "COACH", attachment, author), { status: 201 })
}
