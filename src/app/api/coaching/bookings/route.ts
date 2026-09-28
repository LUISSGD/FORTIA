import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError, str } from "@/lib/coaching/auth"
import { notifyClient } from "@/lib/coaching/notify"
import { dateTimeLima } from "@/lib/coaching/dates"

/** El entrenador reserva una sesión para un cliente. */
export async function POST(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const body = await request.json()
  const slotId = str(body.slotId)
  const clientId = str(body.clientId)
  if (!slotId || !clientId) return jsonError("Datos incompletos")
  const slot = await prisma.coachingSlot.findUnique({ where: { id: slotId }, include: { bookings: { where: { status: "BOOKED" } } } })
  if (!slot) return jsonError("Horario no encontrado", 404)
  const status = slot.bookings.length >= slot.capacity ? "WAITLIST" : "BOOKED"
  const booking = await prisma.coachingBooking.upsert({
    where: { slotId_clientId: { slotId, clientId } },
    create: { slotId, clientId, status },
    update: { status },
  })
  await notifyClient(clientId, { type: "BOOKING", title: status === "BOOKED" ? "Sesión reservada" : "Estás en lista de espera", body: dateTimeLima(slot.startsAt), link: "/app/bookings" })
  return NextResponse.json(booking, { status: 201 })
}
