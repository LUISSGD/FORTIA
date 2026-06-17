import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const classes = await prisma.class.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { slots: true } } },
  })
  return NextResponse.json(classes)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const body = await request.json()
  const cls = await prisma.class.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      color: body.color ?? "#6366f1",
      maxCapacity: Number(body.maxCapacity ?? 20),
    },
  })
  return NextResponse.json(cls, { status: 201 })
}
