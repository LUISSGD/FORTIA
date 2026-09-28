import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireClient, jsonError, str } from "@/lib/coaching/auth"
import { notifyCoach } from "@/lib/coaching/notify"
import { promoteWaitlist } from "@/lib/coaching/bookings"
import { dateTimeLima } from "@/lib/coaching/dates"

/** Reservar: si no hay cupo, queda en lista de espera. */
export async function POST(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const { clientId } = guard
  const slotId = str((await request.json()).slotId)
  if (!slotId) return jsonError("Falta el horario")
  const slot = await prisma.coachingSlot.findUnique({ where: { id: slotId }, include: { bookings: { where: { status: "BOOKED" } } } })
  if (!slot) return jsonError("Horario no encontrado", 404)
  if (slot.startsAt < new Date()) return jsonError("Ese horario ya pasó")

  const existing = await prisma.coachingBooking.findUnique({ where: { slotId_clientId: { slotId, clientId } } })
  if (existing && ["BOOKED", "WAITLIST"].includes(existing.status)) return jsonError("Ya tienes este horario")

  const status = slot.bookings.length >= slot.capacity ? "WAITLIST" : "BOOKED"
  const booking = await prisma.coachingBooking.upsert({
    where: { slotId_clientId: { slotId, clientId } },
    create: { slotId, clientId, status },
    update: { status, createdAt: new Date() },
  })
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { firstName: true, lastName: true } })
  await notifyCoach({
    clientId,
    type: "BOOKING",
    title: status === "BOOKED" ? `${client?.firstName} reservó una sesión` : `${client?.firstName} está en lista de espera`,
    body: dateTimeLima(slot.startsAt),
    link: "/coaching/agenda",
  })
  return NextResponse.json(booking, { status: 201 })
}

/** Cancelar (hasta 2 horas antes). */
export async function DELETE(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const id = new URL(request.url).searchParams.get("id")
  const booking = id ? await prisma.coachingBooking.findFirst({ where: { id, clientId: guard.clientId }, include: { slot: true } }) : null
  if (!booking) return jsonError("Reserva no encontrada", 404)
  if (booking.status === "BOOKED" && booking.slot.startsAt.getTime() - Date.now() < 2 * 3600_000) {
    return jsonError("Solo puedes cancelar hasta 2 horas antes. Escríbele a tu coach.")
  }
  await prisma.coachingBooking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } })
  await promoteWaitlist(booking.slotId)
  const client = await prisma.client.findUnique({ where: { id: guard.clientId }, select: { firstName: true } })
  await notifyCoach({ clientId: guard.clientId, type: "BOOKING", title: `${client?.firstName} canceló su sesión`, body: dateTimeLima(booking.slot.startsAt), link: "/coaching/agenda" })
  return NextResponse.json({ ok: true })
}
