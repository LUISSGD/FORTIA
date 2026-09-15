import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const clients = await prisma.nutritionClient.findMany({
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
    include: {
      consultations: {
        orderBy: { date: "desc" },
        take: 1,
        select: {
          id: true,
          date: true,
          weight: true,
          nextAppointment: true,
          isPaid: true,
          goal: true,
        },
      },
    },
  })
  return NextResponse.json(clients)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await request.json()
  const {
    clientId, firstName, lastName, email, phone, dni, birthDate, gender,
    occupation, physicalActivityLevel, medicalConditions,
    allergies, foodPreferences, currentGoal, referredBy, notes,
  } = body

  const client = await prisma.nutritionClient.create({
    data: {
      clientId: clientId || null,
      firstName,
      lastName,
      email: email || null,
      phone: phone || null,
      dni: dni || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      gender: gender || null,
      occupation: occupation || null,
      physicalActivityLevel: physicalActivityLevel || null,
      medicalConditions: medicalConditions || null,
      allergies: allergies || null,
      foodPreferences: foodPreferences || null,
      currentGoal: currentGoal || null,
      referredBy: referredBy || null,
      notes: notes || null,
    },
  })
  return NextResponse.json(client, { status: 201 })
}
