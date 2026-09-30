import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireNutritionist, jsonError, num, str } from "@/lib/coaching/auth"
import { addDaysYmd, limaDateTime } from "@/lib/coaching/dates"

export async function GET(request: Request) {
  const guard = await requireNutritionist()
  if ("error" in guard) return guard.error
  const sp = new URL(request.url).searchParams
  const from = sp.get("from")
  const to = sp.get("to")
  const slots = await prisma.coachingSlot.findMany({
    where: {
      type: "NUTRITION",
      ...(from && to ? { startsAt: { gte: limaDateTime(from, "00:00"), lt: limaDateTime(addDaysYmd(to, 1), "00:00") } } : {}),
    },
    include: { bookings: { include: { client: { select: { id: true, firstName: true, lastName: true } } } } },
    orderBy: { startsAt: "asc" },
  })
  return NextResponse.json(slots)
}

export async function POST(request: Request) {
  const guard = await requireNutritionist()
  if ("error" in guard) return guard.error
  const body = await request.json()
  const date = str(body.date)
  const times: string[] = (Array.isArray(body.times) ? body.times : [body.time]).filter((t: unknown) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t))
  if (!date || !times.length) return jsonError("Fecha y hora obligatorias")
  const duration = Math.max(15, num(body.durationMin) ?? 60)
  const repeatWeeks = Math.min(12, Math.max(1, num(body.repeatWeeks) ?? 1))
  const weekdays: number[] | null = Array.isArray(body.weekdays) && body.weekdays.length ? body.weekdays.map(Number) : null

  const dates: string[] = []
  for (let w = 0; w < repeatWeeks; w++) {
    if (weekdays) {
      for (let d = 0; d < 7; d++) {
        const ymd = addDaysYmd(date, w * 7 + d)
        const wd = (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7
        if (weekdays.includes(wd)) dates.push(ymd)
      }
    } else dates.push(addDaysYmd(date, w * 7))
  }

  const data = dates.flatMap((ymd) =>
    times.map((t) => {
      const startsAt = limaDateTime(ymd, t)
      return {
        type: "NUTRITION",
        startsAt,
        endsAt: new Date(startsAt.getTime() + duration * 60_000),
        title: str(body.title) ?? "Consulta de nutrición",
        mode: str(body.mode) ?? "PRESENCIAL",
        capacity: Math.max(1, num(body.capacity) ?? 1),
        location: str(body.location),
        notes: str(body.notes),
      }
    })
  )
  const res = await prisma.coachingSlot.createMany({ data })
  return NextResponse.json({ created: res.count }, { status: 201 })
}
