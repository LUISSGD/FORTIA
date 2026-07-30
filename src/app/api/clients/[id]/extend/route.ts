import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { addDays, format } from "date-fns"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await params
  const { days, reason } = await request.json()

  if (!days || days <= 0) return NextResponse.json({ error: "Días inválidos" }, { status: 400 })

  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const oldEnd = client.membershipEnd ? new Date(client.membershipEnd) : new Date()
  const newEnd = addDays(oldEnd, days)
  const concept = `Extensión +${days} días — ${reason}`

  // Record in payment history (amount 0, so it's visible but doesn't affect finances)
  await prisma.payment.create({
    data: {
      clientId: id,
      amount: 0,
      method: "EXTENSION",
      concept,
      periodStart: oldEnd,
      periodEnd: newEnd,
    },
  })

  const updated = await prisma.client.update({
    where: { id },
    data: { membershipEnd: newEnd },
  })

  return NextResponse.json({ membershipEnd: updated.membershipEnd })
}
