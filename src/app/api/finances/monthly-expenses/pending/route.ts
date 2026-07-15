import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const items = await prisma.monthlyExpense.findMany({
    where: { status: "PENDIENTE" },
    orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
  })
  return NextResponse.json(items)
}
