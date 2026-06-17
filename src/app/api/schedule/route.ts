import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const slots = await prisma.scheduleSlot.findMany({
    where: { isActive: true },
    include: {
      class: true,
      enrollments: {
        include: { client: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  })
  return NextResponse.json(slots)
}
