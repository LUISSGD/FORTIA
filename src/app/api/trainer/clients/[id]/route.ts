import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTrainer } from "@/lib/coaching/auth"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { error } = await requireTrainer()
  if (error) return error

  const { id } = await params

  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      birthDate: true,
      trainingPlans: {
        where: { status: { in: ["ACTIVE", "PAUSED"] } },
        include: {
          sessions: { orderBy: [{ isRescheduled: "asc" }, { sessionNumber: "asc" }] },
          scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
        },
        orderBy: { currentPackStart: "desc" },
        take: 1,
      },
    },
  })

  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
  return NextResponse.json(client)
}
