import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { getTrainingPrice } from "@/lib/training-pricing"
import type { Entrenador, Modalidad, Tarifa, NumPacks, ClasesPerPack } from "@/lib/training-pricing"
import { addDays } from "date-fns"

type Ctx = { params: Promise<{ id: string }> }

function generateSessionDates(
  startDate: Date,
  scheduleDays: { dayOfWeek: number }[],
  total: number
): (Date | null)[] {
  if (!scheduleDays.length) return Array(total).fill(null)
  const sorted = [...scheduleDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  const dates: Date[] = []
  let current = new Date(startDate)
  let iterations = 0
  while (dates.length < total && iterations < total * 14) {
    const dow = current.getDay() === 0 ? 6 : current.getDay() - 1 // Mon=0 … Sun=6
    if (sorted.some((d) => d.dayOfWeek === dow)) {
      dates.push(new Date(current))
    }
    current = addDays(current, 1)
    iterations++
  }
  return dates.length ? dates : Array(total).fill(null)
}

export async function GET(_req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const plans = await prisma.clientTrainingPlan.findMany({
    where: { clientId: id },
    include: {
      sessions: { orderBy: [{ isRescheduled: "asc" }, { sessionNumber: "asc" }] },
      scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
    orderBy: { createdAt: "desc" },
  })

  // Auto-fill missing session records for plans created before this feature
  let needsRefresh = false
  for (const plan of plans) {
    const total = plan.numPacks * plan.clasesPerPack
    const normalSessions = plan.sessions.filter((s) => !s.isRescheduled)
    if (normalSessions.length < total) {
      const existing = new Set(normalSessions.map((s) => s.sessionNumber))
      const planStart = plan.currentPackStart ?? plan.createdAt
      const sessionDates = generateSessionDates(planStart, plan.scheduleSlots, total)
      const toCreate = []
      for (let i = 1; i <= total; i++) {
        if (!existing.has(i)) {
          toCreate.push({
            planId: plan.id,
            sessionNumber: i,
            packNumber: Math.floor((i - 1) / plan.clasesPerPack) + 1,
            scheduledDate: sessionDates[i - 1] ?? null,
            attended: null as boolean | null,
            completedAt: null as Date | null,
          })
        }
      }
      if (toCreate.length > 0) {
        await prisma.trainingSession.createMany({ data: toCreate })
        needsRefresh = true
      }
    }
  }

  if (!needsRefresh) return NextResponse.json(plans)

  const refreshed = await prisma.clientTrainingPlan.findMany({
    where: { clientId: id },
    include: {
      sessions: { orderBy: [{ isRescheduled: "asc" }, { sessionNumber: "asc" }] },
      scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(refreshed)
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { tipoEntrenador, modalidad, tarifa, numPacks, clasesPerPack, startDate, notes, scheduleDays } = body

  const price = getTrainingPrice(
    tipoEntrenador as Entrenador,
    modalidad as Modalidad,
    tarifa as Tarifa,
    numPacks as NumPacks,
    clasesPerPack as ClasesPerPack
  )
  if (price === null) {
    return NextResponse.json({ error: "Combinación de plan no válida" }, { status: 400 })
  }

  const planStart = startDate ? new Date(startDate) : new Date()

  const plan = await prisma.clientTrainingPlan.create({
    data: {
      clientId: id,
      modalidad,
      tipoEntrenador,
      tarifa,
      numPacks,
      clasesPerPack,
      pricePaid: price,
      currency: "PEN",
      currentPackStart: planStart,
      notes: notes || null,
    },
    include: {
      sessions: true,
      scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
  })

  // Auto-generate session slots
  const total = numPacks * clasesPerPack
  const sessionDates = generateSessionDates(
    planStart,
    Array.isArray(scheduleDays) ? scheduleDays : [],
    total
  )

  const sessionData = Array.from({ length: total }, (_, i) => ({
    planId: plan.id,
    sessionNumber: i + 1,
    packNumber: Math.floor(i / clasesPerPack) + 1,
    scheduledDate: sessionDates[i] ?? null,
    attended: null as boolean | null,
    completedAt: null as Date | null,
  }))
  await prisma.trainingSession.createMany({ data: sessionData })

  // Create schedule slots
  if (Array.isArray(scheduleDays) && scheduleDays.length > 0) {
    await prisma.personalTrainingSlot.createMany({
      data: scheduleDays.map((d: { dayOfWeek: number; startTime: string; endTime: string }) => ({
        planId: plan.id,
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
      })),
    })
  }

  const finalPlan = await prisma.clientTrainingPlan.findUnique({
    where: { id: plan.id },
    include: {
      sessions: { orderBy: [{ isRescheduled: "asc" }, { sessionNumber: "asc" }] },
      scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
  })

  return NextResponse.json(finalPlan, { status: 201 })
}
