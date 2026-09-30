import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireNutritionist, jsonError, str } from "@/lib/coaching/auth"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireNutritionist()
  if ("error" in guard) return guard.error
  const { id } = await params
  const body = await request.json()
  const status = str(body.status)
  if (!status) return jsonError("Estado requerido")
  const booking = await prisma.coachingBooking.update({ where: { id }, data: { status } })
  return NextResponse.json(booking)
}
