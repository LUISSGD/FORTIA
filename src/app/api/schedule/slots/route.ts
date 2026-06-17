import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const body = await request.json()
  const slot = await prisma.scheduleSlot.create({
    data: {
      classId: body.classId,
      dayOfWeek: Number(body.dayOfWeek),
      startTime: body.startTime,
      endTime: body.endTime,
      instructor: body.instructor ?? null,
      room: body.room ?? null,
    },
    include: { class: true },
  })
  return NextResponse.json(slot, { status: 201 })
}
