import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireClient, jsonError, str } from "@/lib/coaching/auth"
import { todayYmd } from "@/lib/coaching/dates"
import { uploadCoachingFile } from "@/lib/coaching/upload"
import { PHOTO_POSES } from "@/lib/coaching/constants"

/** Multipart: file, pose (FRENTE|PERFIL|ESPALDA), checkInId? */
export async function POST(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const form = await request.formData()
  const file = form.get("file")
  const pose = str(form.get("pose")) ?? "FRENTE"
  if (!(file instanceof File) || !file.type.startsWith("image/")) return jsonError("Sube una imagen")
  if (!(pose in PHOTO_POSES)) return jsonError("Pose inválida")

  const checkInId = str(form.get("checkInId"))
  if (checkInId && !(await prisma.checkIn.findFirst({ where: { id: checkInId, clientId: guard.clientId } }))) return jsonError("Check-in inválido")

  const up = await uploadCoachingFile(file, `progress/${guard.clientId}`)
  if ("error" in up) return jsonError(up.error, 500)
  const photo = await prisma.progressPhoto.create({
    data: { clientId: guard.clientId, date: todayYmd(), pose, url: up.url, checkInId },
  })
  return NextResponse.json(photo, { status: 201 })
}

export async function DELETE(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return jsonError("Falta id")
  await prisma.progressPhoto.deleteMany({ where: { id, clientId: guard.clientId } })
  return NextResponse.json({ ok: true })
}
