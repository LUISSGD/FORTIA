import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, num, str } from "@/lib/coaching/auth"
import { notifyClient } from "@/lib/coaching/notify"
import { dateTimeLima } from "@/lib/coaching/dates"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const body = await request.json()
  const slot = await prisma.coachingSlot.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: str(body.title) ?? "Sesión de entrenamiento" } : {}),
      ...(body.capacity !== undefined ? { capacity: Math.max(1, num(body.capacity) ?? 1) } : {}),
      ...(body.mode !== undefined ? { mode: str(body.mode) ?? "PRESENCIAL" } : {}),
      ...(body.location !== undefined ? { location: str(body.location) } : {}),
      ...(body.notes !== undefined ? { notes: str(body.notes) } : {}),
    },
  })
  return NextResponse.json(slot)
}

/** Elimina el horario y avisa a los clientes que tenían reserva. */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const slot = await prisma.coachingSlot.findUnique({ where: { id }, include: { bookings: { where: { status: { in: ["BOOKED", "WAITLIST"] } } } } })
  if (slot) {
    for (const b of slot.bookings) {
      await notifyClient(b.clientId, { type: "BOOKING", title: "Sesión cancelada", body: `La sesión del ${dateTimeLima(slot.startsAt)} fue cancelada por tu coach.`, link: "/app/bookings" })
    }
    await prisma.coachingSlot.delete({ where: { id } })
  }
  return NextResponse.json({ ok: true })
}
