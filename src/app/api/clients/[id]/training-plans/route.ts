import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { getTrainingPrice } from "@/lib/training-pricing"
import type { Entrenador, Modalidad, Tarifa, NumPacks, ClasesPerPack } from "@/lib/training-pricing"


type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const plans = await prisma.clientTrainingPlan.findMany({
    where: { clientId: id },
    include: {
      sessions: { orderBy: { sessionNumber: "asc" } },
      scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(plans)
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
      currentPackStart: startDate ? new Date(startDate) : new Date(),
      notes: notes || null,
    },
    include: {
      sessions: true,
      scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
  })

  if (Array.isArray(scheduleDays) && scheduleDays.length > 0) {
    await prisma.personalTrainingSlot.createMany({
      data: scheduleDays.map((d: { dayOfWeek: number; startTime: string; endTime: string }) => ({
        planId: plan.id,
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
      })),
    })
    const updatedSlots = await prisma.personalTrainingSlot.findMany({
      where: { planId: plan.id },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    })
    return NextResponse.json({ ...plan, scheduleSlots: updatedSlots }, { status: 201 })
  }

  return NextResponse.json(plan, { status: 201 })
}
