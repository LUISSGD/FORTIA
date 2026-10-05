import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireClient, jsonError, str } from "@/lib/coaching/auth"
import { notifyCoach } from "@/lib/coaching/notify"
import { uploadCoachingFile } from "@/lib/coaching/upload"

export async function GET() {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const { clientId } = guard
  const [messages] = await Promise.all([
    prisma.coachMessage.findMany({ where: { clientId, channel: "COACHING" }, orderBy: { createdAt: "asc" }, take: 300 }),
    prisma.coachMessage.updateMany({ where: { clientId, channel: "COACHING", sender: { not: "CLIENT" }, readAt: null }, data: { readAt: new Date() } }),
    prisma.notification.updateMany({ where: { clientId, audience: "CLIENT", type: "MESSAGE", readAt: null }, data: { readAt: new Date() } }),
  ])
  return NextResponse.json(messages)
}

/** JSON { body } o multipart { body?, file } */
export async function POST(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const { clientId } = guard
  let text: string | null = null
  let attachment: { url: string; type: string } | null = null

  if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await request.formData()
    text = str(form.get("body"))
    const file = form.get("file")
    if (file instanceof File && file.size > 0) {
      const up = await uploadCoachingFile(file, `chat/${clientId}`)
      if ("error" in up) return jsonError(up.error, 500)
      attachment = up
    }
  } else {
    text = str((await request.json()).body)
  }
  if (!text && !attachment) return jsonError("Mensaje vacío")

  const msg = await prisma.coachMessage.create({
    data: { clientId, sender: "CLIENT", body: text ?? "", attachmentUrl: attachment?.url ?? null, attachmentType: attachment?.type ?? null },
  })
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { firstName: true } })
  await notifyCoach({ clientId, type: "MESSAGE", title: `Mensaje de ${client?.firstName}`, body: text?.slice(0, 100) ?? "📎 Adjunto", link: `/coaching/messages?c=${clientId}` })
  return NextResponse.json(msg, { status: 201 })
}
