import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireClient } from "@/lib/coaching/auth"

export async function GET() {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const { clientId } = guard
  const bookings = await prisma.coachingBooking.findMany({
    where: { clientId, status: "BOOKED", slot: { type: "NUTRITION", startsAt: { gte: new Date() } } },
    orderBy: { slot: { startsAt: "asc" } },
    take: 5,
    include: { slot: { select: { startsAt: true, endsAt: true, title: true, mode: true, location: true } } },
  })
  return NextResponse.json(bookings)
}
