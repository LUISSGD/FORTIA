import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type Ctx = { params: Promise<{ id: string; planId: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { planId } = await params
  const slots = await prisma.personalTrainingSlot.findMany({
    where: { planId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  })
  return NextResponse.json(slots)
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { planId } = await params
  const body = await req.json()
  const { dayOfWeek, startTime, endTime } = body

  if (dayOfWeek === undefined || !startTime || !endTime) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 })
  }

  const slot = await prisma.personalTrainingSlot.create({
    data: { planId, dayOfWeek, startTime, endTime },
  })
  return NextResponse.json(slot, { status: 201 })
}

export async function DELETE(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { planId } = await params
  const url = new URL(req.url)
  const slotId = url.searchParams.get("slotId")

  if (!slotId) return NextResponse.json({ error: "slotId requerido" }, { status: 400 })

  const slot = await prisma.personalTrainingSlot.findUnique({ where: { id: slotId } })
  if (!slot || slot.planId !== planId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  await prisma.personalTrainingSlot.delete({ where: { id: slotId } })
  return NextResponse.json({ ok: true })
}
