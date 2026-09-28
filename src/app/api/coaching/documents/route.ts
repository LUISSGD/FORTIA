import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError, str } from "@/lib/coaching/auth"
import { notifyClient } from "@/lib/coaching/notify"
import { uploadCoachingFile } from "@/lib/coaching/upload"

/** Multipart: title, description?, category, clientId? (vacío = todos), file | url */
export async function POST(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const form = await request.formData()
  const title = str(form.get("title"))
  if (!title) return jsonError("Título obligatorio")
  const clientId = str(form.get("clientId"))
  const file = form.get("file")
  let url = str(form.get("url"))
  let type = "LINK"

  if (file instanceof File && file.size > 0) {
    const up = await uploadCoachingFile(file, "documents")
    if ("error" in up) return jsonError(up.error, 500)
    url = up.url
    type = up.type === "IMAGE" ? "IMAGE" : up.type === "VIDEO" ? "VIDEO" : "PDF"
  } else if (url) {
    type = /youtu|vimeo|\.mp4$/i.test(url) ? "VIDEO" : /\.pdf$/i.test(url) ? "PDF" : "LINK"
  }
  if (!url) return jsonError("Adjunta un archivo o un enlace")

  const doc = await prisma.coachDocument.create({
    data: { title, description: str(form.get("description")), category: str(form.get("category")) ?? "GENERAL", type, url, clientId },
  })

  const targets = clientId
    ? [clientId]
    : (await prisma.coachingProfile.findMany({ where: { status: "ACTIVE" }, select: { clientId: true } })).map((p) => p.clientId)
  for (const cid of targets) await notifyClient(cid, { type: "SYSTEM", title: "Nuevo documento", body: title, link: "/app/documents" })

  return NextResponse.json(doc, { status: 201 })
}
