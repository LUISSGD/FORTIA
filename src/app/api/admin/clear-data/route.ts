import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach } from "@/lib/coaching/auth"

export async function DELETE() {
  // Acción destructiva: solo el administrador.
  const guard = await requireCoach()
  if ("error" in guard) return guard.error

  await prisma.enrollment.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.income.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.client.deleteMany()

  return NextResponse.json({ ok: true })
}
