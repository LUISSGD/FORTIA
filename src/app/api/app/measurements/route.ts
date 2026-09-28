import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireClient, jsonError, num, str } from "@/lib/coaching/auth"
import { todayYmd } from "@/lib/coaching/dates"

export async function POST(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const b = await request.json()
  const data = {
    weight: num(b.weight), bodyFat: num(b.bodyFat), chest: num(b.chest), waist: num(b.waist),
    hips: num(b.hips), arms: num(b.arms), legs: num(b.legs),
  }
  if (Object.values(data).every((v) => v === null)) return jsonError("Ingresa al menos una medida")
  const date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : todayYmd()
  const record = await prisma.physicalRecord.create({
    data: { clientId: guard.clientId, date: new Date(`${date}T12:00:00Z`), ...data, notes: str(b.notes) },
  })
  return NextResponse.json(record, { status: 201 })
}

export async function DELETE(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return jsonError("Falta id")
  await prisma.physicalRecord.deleteMany({ where: { id, clientId: guard.clientId } })
  return NextResponse.json({ ok: true })
}
