import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { addDays, format } from "date-fns"
import { es } from "date-fns/locale"

export async function POST(request: Request, ctx: RouteContext<"/api/clients/[id]/extend">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  const { days, reason } = await request.json()

  if (!days || days <= 0) return NextResponse.json({ error: "Días inválidos" }, { status: 400 })

  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const baseDate = client.membershipEnd ? new Date(client.membershipEnd) : new Date()
  const newEnd = addDays(baseDate, days)

  const logEntry = `[${format(new Date(), "dd/MM/yyyy")}] +${days} días — ${reason || "Sin justificación"}`
  const updatedNotes = client.notes ? `${client.notes}\n${logEntry}` : logEntry

  const updated = await prisma.client.update({
    where: { id },
    data: { membershipEnd: newEnd, notes: updatedNotes },
  })

  return NextResponse.json({ membershipEnd: updated.membershipEnd, notes: updated.notes })
}
