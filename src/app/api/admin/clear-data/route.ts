import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function DELETE() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  await prisma.enrollment.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.income.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.client.deleteMany()

  return NextResponse.json({ ok: true })
}
