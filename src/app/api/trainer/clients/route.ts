import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTrainer } from "@/lib/coaching/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const { error } = await requireTrainer()
  if (error) return error

  const plans = await prisma.clientTrainingPlan.findMany({
    where: { status: { in: ["ACTIVE", "PAUSED"] } },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, phone: true } },
      sessions: { orderBy: [{ isRescheduled: "asc" }, { sessionNumber: "asc" }] },
      scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
    orderBy: { currentPackStart: "desc" },
  })

  return NextResponse.json(plans)
}
