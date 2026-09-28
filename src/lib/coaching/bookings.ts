import { prisma } from "@/lib/prisma"
import { notifyClient } from "./notify"
import { dateTimeLima } from "./dates"

/** Si se libera una plaza, pasa al primero de la lista de espera a reservado. */
export async function promoteWaitlist(slotId: string) {
  const slot = await prisma.coachingSlot.findUnique({
    where: { id: slotId },
    include: { bookings: { where: { status: { in: ["BOOKED", "WAITLIST"] } }, orderBy: { createdAt: "asc" } } },
  })
  if (!slot) return
  const booked = slot.bookings.filter((b) => b.status === "BOOKED").length
  const free = slot.capacity - booked
  const waiting = slot.bookings.filter((b) => b.status === "WAITLIST").slice(0, Math.max(0, free))
  for (const b of waiting) {
    await prisma.coachingBooking.update({ where: { id: b.id }, data: { status: "BOOKED" } })
    await notifyClient(b.clientId, { type: "BOOKING", title: "¡Se liberó un cupo!", body: `Tu sesión del ${dateTimeLima(slot.startsAt)} está confirmada.`, link: "/app/bookings" })
  }
}
