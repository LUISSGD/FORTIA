import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireNutritionist, jsonError, str } from "@/lib/coaching/auth"
import { notifyClient } from "@/lib/coaching/notify"

type Params = { params: Promise<{ clientId: string }> }

/**
 * Chat de nutrición del cliente. Con `?peek=1` el ADMIN lo consulta sin marcar como leídos
 * los mensajes del cliente (así no se le pierden a la nutricionista).
 */
export async function GET(request: Request, { params }: Params) {
  const guard = await requireNutritionist()
  if ("error" in guard) return guard.error
  const { clientId } = await params
  const peek = new URL(request.url).searchParams.get("peek") === "1" && guard.role === "ADMIN"
  const [messages] = await Promise.all([
    prisma.coachMessage.findMany({ where: { clientId, channel: "NUTRITION" }, orderBy: { createdAt: "asc" }, take: 300 }),
    peek ? null : prisma.coachMessage.updateMany({ where: { clientId, channel: "NUTRITION", sender: "CLIENT", readAt: null }, data: { readAt: new Date() } }),
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
  const user = guard.session.user
  const authorName = user.name?.trim() || "Tu nutricionista"
  const msg = await prisma.coachMessage.create({
    data: { clientId, sender: "COACH", channel: "NUTRITION", body: text, authorUserId: user.id ?? null, authorName },
  })
  await notifyClient(clientId, {
    type: "MESSAGE",
    title: `Nuevo mensaje de ${authorName}`,
    body: text.length > 90 ? `${text.slice(0, 87)}…` : text,
    link: "/app/nutrition/chat",
  })
  return NextResponse.json(msg, { status: 201 })
}
