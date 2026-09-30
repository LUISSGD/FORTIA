import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireNutritionist, jsonError } from "@/lib/coaching/auth"

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireNutritionist()
  if ("error" in guard) return guard.error
  const { id } = await params
  const slot = await prisma.coachingSlot.findUnique({ where: { id }, select: { type: true } })
  if (!slot || slot.type !== "NUTRITION") return jsonError("No encontrado", 404)
  await prisma.coachingSlot.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
