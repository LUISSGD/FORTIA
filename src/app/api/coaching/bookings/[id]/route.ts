import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError, str } from "@/lib/coaching/auth"
import { promoteWaitlist } from "@/lib/coaching/bookings"

type Params = { params: Promise<{ id: string }> }

const STATUSES = ["BOOKED", "WAITLIST", "CANCELLED", "ATTENDED", "NO_SHOW"]

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const status = str((await request.json()).status)
  if (!status || !STATUSES.includes(status)) return jsonError("Estado inválido")
  const booking = await prisma.coachingBooking.update({ where: { id }, data: { status } })
  if (status === "CANCELLED") await promoteWaitlist(booking.slotId)
  return NextResponse.json(booking)
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const booking = await prisma.coachingBooking.delete({ where: { id } })
  await promoteWaitlist(booking.slotId)
  return NextResponse.json({ ok: true })
}
