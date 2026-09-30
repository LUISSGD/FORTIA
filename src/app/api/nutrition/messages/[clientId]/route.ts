import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireNutritionist, jsonError, str } from "@/lib/coaching/auth"
import { notifyClient } from "@/lib/coaching/notify"

type Params = { params: Promise<{ clientId: string }> }

export async function GET(_request: Request, { params }: Params) {
  const guard = await requireNutritionist()
  if ("error" in guard) return guard.error
  const { clientId } = await params
  const [messages] = await Promise.all([
    prisma.coachMessage.findMany({ where: { clientId, channel: "NUTRITION" }, orderBy: { createdAt: "asc" }, take: 300 }),
    prisma.coachMessage.updateMany({ where: { clientId, channel: "NUTRITION", sender: "CLIENT", readAt: null }, data: { readAt: new Date() } }),
  ])
  return NextResponse.json(messages)
}

export async function POST(request: Request, { params }: Params) {
  const guard = await requireNutritionist()
  if ("error" in guard) return guard.error
  const { clientId } = await params
  const body = await request.json()
  const text = str(body.body) ?? ""
  if (!text) return jsonError("Mensaje vacío")
  const msg = await prisma.coachMessage.create({
    data: { clientId, sender: "COACH", channel: "NUTRITION", body: text },
  })
  await notifyClient(clientId, {
    type: "MESSAGE",
    title: "Nuevo mensaje de tu nutricionista",
    body: text.length > 90 ? `${text.slice(0, 87)}…` : text,
    link: "/app/nutrition/chat",
  })
  return NextResponse.json(msg, { status: 201 })
}
