import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { addDays } from "date-fns"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const planId = searchParams.get("planId")
  const expiringSoon = searchParams.get("expiringSoon") === "true"

  const now = new Date()
  const sevenDays = addDays(now, 7)

  const clients = await prisma.client.findMany({
    where: {
      isActive: true,
      ...(search && {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { dni: { contains: search } },
          { phone: { contains: search } },
        ],
      }),
      ...(planId && { membershipPlanId: planId }),
      ...(expiringSoon && {
        membershipEnd: { gte: now, lte: sevenDays },
      }),
    },
    include: { membershipPlan: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(clients)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await request.json()

  const client = await prisma.client.create({
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone || null,
      dni: body.dni || null,
      firstName2: body.firstName2 || null,
      lastName2: body.lastName2 || null,
      phone2: body.phone2 || null,
      dni2: body.dni2 || null,
      notes: body.notes || null,
      membershipPlanId: body.membershipPlanId || null,
      membershipStart: null,
      membershipEnd: null,
    },
    include: { membershipPlan: true },
  })
  return NextResponse.json(client, { status: 201 })
}
