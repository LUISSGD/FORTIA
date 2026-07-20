import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: clientId } = await params
  const records = await prisma.physicalRecord.findMany({
    where: { clientId },
    orderBy: { date: "desc" },
  })
  return NextResponse.json(records)
}

export async function POST(request: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: clientId } = await params
  const body = await request.json()
  const { date, weight, height, bodyFat, chest, waist, hips, arms, legs, notes } = body

  const record = await prisma.physicalRecord.create({
    data: {
      clientId,
      date: new Date(date + "T00:00:00"),
      weight: weight ? Number(weight) : null,
      height: height ? Number(height) : null,
      bodyFat: bodyFat ? Number(bodyFat) : null,
      chest: chest ? Number(chest) : null,
      waist: waist ? Number(waist) : null,
      hips: hips ? Number(hips) : null,
      arms: arms ? Number(arms) : null,
      legs: legs ? Number(legs) : null,
      notes: notes || null,
    },
  })
  return NextResponse.json(record, { status: 201 })
}
