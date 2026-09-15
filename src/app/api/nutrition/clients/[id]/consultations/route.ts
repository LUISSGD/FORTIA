import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: nutritionClientId } = await params
  const consultations = await prisma.nutritionConsultation.findMany({
    where: { nutritionClientId },
    orderBy: { date: "desc" },
  })
  return NextResponse.json(consultations)
}

export async function POST(request: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: nutritionClientId } = await params
  const body = await request.json()

  const count = await prisma.nutritionConsultation.count({ where: { nutritionClientId } })

  const consultation = await prisma.nutritionConsultation.create({
    data: {
      nutritionClientId,
      consultationNumber: count + 1,
      date: new Date(body.date),
      weight: body.weight ? Number(body.weight) : null,
      height: body.height ? Number(body.height) : null,
      bodyFat: body.bodyFat ? Number(body.bodyFat) : null,
      muscleMass: body.muscleMass ? Number(body.muscleMass) : null,
      visceralFat: body.visceralFat ? Number(body.visceralFat) : null,
      waist: body.waist ? Number(body.waist) : null,
      hips: body.hips ? Number(body.hips) : null,
      arms: body.arms ? Number(body.arms) : null,
      goal: body.goal || null,
      calTarget: body.calTarget ? Number(body.calTarget) : null,
      proteinTarget: body.proteinTarget ? Number(body.proteinTarget) : null,
      carbsTarget: body.carbsTarget ? Number(body.carbsTarget) : null,
      fatTarget: body.fatTarget ? Number(body.fatTarget) : null,
      waterTarget: body.waterTarget ? Number(body.waterTarget) : null,
      dietPlan: body.dietPlan || null,
      supplements: body.supplements || null,
      recommendations: body.recommendations || null,
      observations: body.observations || null,
      nextAppointment: body.nextAppointment ? new Date(body.nextAppointment) : null,
      isPaid: body.isPaid ?? false,
      paymentAmount: body.paymentAmount ? Number(body.paymentAmount) : null,
      paymentMethod: body.paymentMethod || null,
    },
  })
  return NextResponse.json(consultation, { status: 201 })
}
