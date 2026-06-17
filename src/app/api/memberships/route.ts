import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const plans = await prisma.membershipPlan.findMany({
    where: { isActive: true },
    orderBy: { durationDays: "asc" },
    include: { _count: { select: { clients: { where: { isActive: true } } } } },
  })
  return NextResponse.json(plans)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await request.json()
  const plan = await prisma.membershipPlan.create({
    data: {
      name: body.name,
      durationDays: Number(body.durationDays),
      price: Number(body.price),
      description: body.description ?? null,
    },
  })
  return NextResponse.json(plan, { status: 201 })
}
