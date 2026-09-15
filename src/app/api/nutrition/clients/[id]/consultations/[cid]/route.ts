import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type Params = { params: Promise<{ id: string; cid: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { cid } = await params
  const consultation = await prisma.nutritionConsultation.findUnique({ where: { id: cid } })
  if (!consultation) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(consultation)
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { cid } = await params
  const body = await request.json()

  const consultation = await prisma.nutritionConsultation.update({
    where: { id: cid },
    data: {
      date: body.date ? new Date(body.date) : undefined,
      weight: body.weight != null ? Number(body.weight) : null,
      height: body.height != null ? Number(body.height) : null,
      bodyFat: body.bodyFat != null ? Number(body.bodyFat) : null,
      muscleMass: body.muscleMass != null ? Number(body.muscleMass) : null,
      visceralFat: body.visceralFat != null ? Number(body.visceralFat) : null,
      waist: body.waist != null ? Number(body.waist) : null,
      hips: body.hips != null ? Number(body.hips) : null,
      arms: body.arms != null ? Number(body.arms) : null,
      goal: body.goal || null,
      calTarget: body.calTarget != null ? Number(body.calTarget) : null,
      proteinTarget: body.proteinTarget != null ? Number(body.proteinTarget) : null,
      carbsTarget: body.carbsTarget != null ? Number(body.carbsTarget) : null,
      fatTarget: body.fatTarget != null ? Number(body.fatTarget) : null,
      waterTarget: body.waterTarget != null ? Number(body.waterTarget) : null,
      dietPlan: body.dietPlan ?? undefined,
      supplements: body.supplements ?? undefined,
      recommendations: body.recommendations ?? undefined,
      observations: body.observations ?? undefined,
      nextAppointment: body.nextAppointment ? new Date(body.nextAppointment) : null,
      isPaid: body.isPaid ?? undefined,
      paymentAmount: body.paymentAmount != null ? Number(body.paymentAmount) : null,
      paymentMethod: body.paymentMethod || null,
    },
  })
  return NextResponse.json(consultation)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { cid } = await params
  await prisma.nutritionConsultation.delete({ where: { id: cid } })
  return NextResponse.json({ ok: true })
}
