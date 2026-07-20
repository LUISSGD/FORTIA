import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type Params = { params: Promise<{ id: string }> }

// GET /api/schedule/slots/[id]/attendance?date=YYYY-MM-DD
// Returns enrolled clients with their attendance status for the given date
export async function GET(request: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: slotId } = await params
  const { searchParams } = new URL(request.url)
  const dateStr = searchParams.get("date")
  if (!dateStr) return NextResponse.json({ error: "Falta el parámetro date" }, { status: 400 })

  const date = new Date(dateStr + "T00:00:00")

  const [enrollments, attendances] = await Promise.all([
    prisma.enrollment.findMany({
      where: { slotId },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { client: { firstName: "asc" } },
    }),
    prisma.attendance.findMany({
      where: { slotId, date },
    }),
  ])

  const attendanceMap = new Map(attendances.map((a) => [a.clientId, a.attended]))

  const result = enrollments.map((e) => ({
    clientId: e.client.id,
    firstName: e.client.firstName,
    lastName: e.client.lastName,
    attended: attendanceMap.get(e.client.id) ?? false,
  }))

  return NextResponse.json(result)
}

// POST /api/schedule/slots/[id]/attendance
// Body: { clientId, date, attended }
// Upserts attendance for a single client on a specific date
export async function POST(request: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: slotId } = await params
  const { clientId, date: dateStr, attended } = await request.json()

  const date = new Date(dateStr + "T00:00:00")

  const record = await prisma.attendance.upsert({
    where: { slotId_clientId_date: { slotId, clientId, date } },
    update: { attended, markedAt: new Date() },
    create: { slotId, clientId, date, attended },
  })

  return NextResponse.json(record)
}
