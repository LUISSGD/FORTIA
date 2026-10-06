import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { calendarDate, sessionDatesFrom } from "@/lib/calendar"
import { recordTrainingPayment } from "@/lib/finance-sync"
import { trainingDescription } from "@/lib/training-pricing"

type Ctx = { params: Promise<{ id: string; planId: string }> }

// Fechas de clases: una sola regla para todo FORTIA (src/lib/calendar.ts)
const generateSessionDates = sessionDatesFrom

export async function POST(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: clientId, planId } = await params
  const body = await req.json()
  const { startDate, pricePaid, registerPayment, paymentMethod } = body

  if (!startDate) {
    return NextResponse.json({ error: "startDate es requerido" }, { status: 400 })
  }

  // Load original plan + its schedule slots
  const original = await prisma.clientTrainingPlan.findUnique({
    where: { id: planId, clientId },
    include: { scheduleSlots: true },
  })
  if (!original) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })

  const planStart = calendarDate(startDate)
  const total = original.numPacks * original.clasesPerPack
  const sessionDates = generateSessionDates(planStart, original.scheduleSlots, total)

  // Create the new plan with same config
  const newPlan = await prisma.clientTrainingPlan.create({
    data: {
      clientId,
      modalidad: original.modalidad,
      tipoEntrenador: original.tipoEntrenador,
      tarifa: original.tarifa,
      numPacks: original.numPacks,
      clasesPerPack: original.clasesPerPack,
      pricePaid: pricePaid ?? original.pricePaid,
      currency: original.currency,
      currentPackStart: planStart,
      notes: original.notes,
    },
  })

  // Copy schedule slots from original
  if (original.scheduleSlots.length > 0) {
    await prisma.personalTrainingSlot.createMany({
      data: original.scheduleSlots.map((s) => ({
        planId: newPlan.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    })
  }

  // Generate sessions
  const sessionData = Array.from({ length: total }, (_, i) => ({
    planId: newPlan.id,
    sessionNumber: i + 1,
    packNumber: Math.floor(i / original.clasesPerPack) + 1,
    scheduledDate: sessionDates[i] ?? null,
    attended: null as boolean | null,
    completedAt: null as Date | null,
  }))
  await prisma.trainingSession.createMany({ data: sessionData })

  // Cobro de la renovación → ingreso en Finanzas + pago en la ficha, vinculados al nuevo paquete.
  if (registerPayment && Number(newPlan.pricePaid) > 0) {
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { firstName: true, lastName: true } })
    await prisma.$transaction((tx) =>
      recordTrainingPayment(tx, {
        clientId, planId: newPlan.id, amount: Number(newPlan.pricePaid), method: paymentMethod, date: planStart,
        description: `Renovación ${trainingDescription(newPlan, `${client?.firstName ?? ""} ${client?.lastName ?? ""}`.trim())}`,
      }),
    )
  }

  // Mark original as COMPLETED
  await prisma.clientTrainingPlan.update({
    where: { id: planId },
    data: { status: "COMPLETED" },
  })

  const finalPlan = await prisma.clientTrainingPlan.findUnique({
    where: { id: newPlan.id },
    include: {
      sessions: { orderBy: [{ isRescheduled: "asc" }, { sessionNumber: "asc" }] },
      scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
  })

  return NextResponse.json(finalPlan, { status: 201 })
}
