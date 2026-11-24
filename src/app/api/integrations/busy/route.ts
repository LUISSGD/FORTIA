import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { calendarDate, calendarYmd } from "@/lib/calendar"
import { VISIBLE_SESSIONS } from "@/lib/coaching/personal-training"
import { addDaysYmd, diffDaysYmd, weekdayYmd } from "@/lib/coaching/dates"
import { sessionTime } from "@/lib/session-time"
import { botGuard, isYmd } from "@/lib/integrations/bot"

export const dynamic = "force-dynamic"

type Block = {
  date: string // YYYY-MM-DD (Lima)
  start: string // HH:MM
  durationMin: number
  trainer: string | null // null = sin entrenador asignado
  kind: "EP" | "TRIAL" | "COACHING" | "CLASS"
  id: string
}

const LIMA_HM = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
const minutesBetween = (a: string, b: string) => {
  const [ah, am] = a.split(":").map(Number), [bh, bm] = b.split(":").map(Number)
  return bh * 60 + bm - (ah * 60 + am)
}

/**
 * GET /api/integrations/busy?from=YYYY-MM-DD&to=YYYY-MM-DD[&exclude=trialId,trialId]
 * Todo lo que ocupa a un entrenador entre esos días (incluidos), para que el bot no ofrezca una
 * clase de prueba encima: clases EP, clases de prueba, citas de coaching presenciales y clases grupales.
 */
export async function GET(req: Request) {
  const denied = botGuard(req)
  if (denied) return denied
  const sp = new URL(req.url).searchParams
  const from = sp.get("from"), to = sp.get("to")
  if (!isYmd(from) || !isYmd(to) || to < from || diffDaysYmd(to, from) > 31) {
    return NextResponse.json({ error: "from y to (YYYY-MM-DD), máximo 31 días" }, { status: 400 })
  }
  const exclude = (sp.get("exclude") ?? "").split(",").filter(Boolean)
  const lte = calendarDate(to), gte = calendarDate(from)

  const [sessions, trials, coaching, groupSlots] = await Promise.all([
    prisma.trainingSession.findMany({
      where: { scheduledDate: { gte, lte }, ...VISIBLE_SESSIONS },
      select: {
        id: true, scheduledDate: true, startTime: true, trainer: true,
        plan: { select: { scheduleSlots: { select: { dayOfWeek: true, startTime: true } }, client: { select: { trainer: true } } } },
      },
    }),
    prisma.trialClass.findMany({
      where: { trialDate: { gte, lte }, status: { not: "CANCELLED" }, id: { notIn: exclude } },
      select: { id: true, trialDate: true, startTime: true, durationMin: true, trainer: true },
    }),
    prisma.coachingSlot.findMany({
      where: {
        startsAt: { gte: new Date(`${from}T05:00:00Z`), lt: new Date(`${addDaysYmd(to, 1)}T05:00:00Z`) },
        mode: "PRESENCIAL",
        bookings: { some: { status: { in: ["BOOKED", "ATTENDED"] } } },
      },
      select: { id: true, startsAt: true, endsAt: true },
    }),
    prisma.scheduleSlot.findMany({
      where: { isActive: true, class: { isActive: true } },
      select: { id: true, dayOfWeek: true, startTime: true, endTime: true, instructor: true },
    }),
  ])

  const blocks: Block[] = []
  for (const s of sessions) {
    const date = calendarYmd(s.scheduledDate!)
    const start = sessionTime({ startTime: s.startTime, scheduledYmd: date }, s.plan.scheduleSlots)
    if (!start) continue
    // El entrenador del cliente (el que pinta la agenda); el guardado en la sesión solo existe tras marcar asistencia
    blocks.push({ date, start, durationMin: 60, trainer: s.plan.client.trainer ?? s.trainer ?? null, kind: "EP", id: s.id })
  }
  for (const t of trials) {
    blocks.push({ date: calendarYmd(t.trialDate), start: t.startTime, durationMin: t.durationMin, trainer: t.trainer, kind: "TRIAL", id: t.id })
  }
  for (const c of coaching) {
    blocks.push({
      date: calendarYmd(c.startsAt), start: LIMA_HM.format(c.startsAt), durationMin: Math.max(15, Math.round((+c.endsAt - +c.startsAt) / 60_000)),
      trainer: null, kind: "COACHING", id: c.id,
    })
  }
  for (let d = from; d <= to; d = addDaysYmd(d, 1)) {
    const wd = weekdayYmd(d)
    for (const g of groupSlots) {
      if (g.dayOfWeek !== wd) continue
      blocks.push({ date: d, start: g.startTime.slice(0, 5), durationMin: Math.max(15, minutesBetween(g.startTime.slice(0, 5), g.endTime.slice(0, 5)) || 60), trainer: g.instructor?.trim() || null, kind: "CLASS", id: g.id })
    }
  }
  blocks.sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`))
  return NextResponse.json({ from, to, blocks })
}
