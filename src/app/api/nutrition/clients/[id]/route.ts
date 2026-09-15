import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const client = await prisma.nutritionClient.findUnique({
    where: { id },
    include: {
      consultations: { orderBy: { date: "desc" } },
    },
  })
  if (!client) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(client)
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const client = await prisma.nutritionClient.update({
    where: { id },
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone || null,
      dni: body.dni || null,
      birthDate: body.birthDate ? new Date(body.birthDate) : null,
      gender: body.gender || null,
      occupation: body.occupation || null,
      physicalActivityLevel: body.physicalActivityLevel || null,
      medicalConditions: body.medicalConditions || null,
      allergies: body.allergies || null,
      foodPreferences: body.foodPreferences || null,
      currentGoal: body.currentGoal || null,
      referredBy: body.referredBy || null,
      notes: body.notes || null,
      isActive: body.isActive ?? undefined,
    },
  })
  return NextResponse.json(client)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  await prisma.nutritionClient.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
