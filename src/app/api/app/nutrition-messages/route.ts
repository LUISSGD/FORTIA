import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireClient, jsonError, str } from "@/lib/coaching/auth"
import { notifyCoach } from "@/lib/coaching/notify"

export async function GET() {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const { clientId } = guard
  const [messages] = await Promise.all([
    prisma.coachMessage.findMany({ where: { clientId, channel: "NUTRITION" }, orderBy: { createdAt: "asc" }, take: 300 }),
    prisma.coachMessage.updateMany({ where: { clientId, channel: "NUTRITION", sender: { not: "CLIENT" }, readAt: null }, data: { readAt: new Date() } }),
  ])
  return NextResponse.json(messages)
}

export async function POST(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const { clientId } = guard
  const text = str((await request.json()).body)
  if (!text) return jsonError("Mensaje vacío")
  const msg = await prisma.coachMessage.create({
    data: { clientId, sender: "CLIENT", channel: "NUTRITION", body: text },
  })
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { firstName: true } })
  await notifyCoach({ clientId, type: "MESSAGE", title: `Mensaje de ${client?.firstName} (nutrición)`, body: text.slice(0, 100), link: `/nutrition/clients/${clientId}?tab=chat` })
  return NextResponse.json(msg, { status: 201 })
}
