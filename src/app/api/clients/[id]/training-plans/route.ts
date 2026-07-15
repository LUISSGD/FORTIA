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
    include: { sessions: { orderBy: { sessionNumber: "asc" } } },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(plans)
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { tipoEntrenador, modalidad, tarifa, numPacks, clasesPerPack, startDate, notes } = body

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

  const income = await prisma.income.create({
    data: {
      amount: price,
      currency: "PEN",
      category: "PERSONAL_TRAINING",
      description: `${modalidad === "ELITE_ATHLETE_PAREJAS" ? "Elite Athlete Parejas" : "Elite Athlete"} — ${tipoEntrenador === "HEAD_COACH" ? "Head Coach" : "Team Fortia"} — ${numPacks} pack(s) x ${clasesPerPack} clases`,
      clientId: id,
      date: startDate ? new Date(startDate) : new Date(),
    },
  })

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
      incomeId: income.id,
    },
    include: { sessions: true },
  })

  return NextResponse.json(plan, { status: 201 })
}
