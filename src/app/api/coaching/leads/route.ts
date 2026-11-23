import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError } from "@/lib/coaching/auth"
import { getLeads, parseLeadInput } from "@/lib/coaching/leads"

export async function GET() {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  return NextResponse.json(await getLeads())
}

/** Agrega un interesado a mano. */
export async function POST(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const r = parseLeadInput(await request.json().catch(() => ({})))
  if ("error" in r) return jsonError(r.error ?? "Datos inválidos")
  const data = r.data as { firstName: string; phone?: string | null }
  if (data.phone) {
    const open = await prisma.lead.findFirst({ where: { phone: data.phone, stage: { notIn: ["WON", "LOST"] } }, select: { firstName: true, lastName: true } })
    if (open) return jsonError(`Ya tienes a un interesado con ese celular: ${[open.firstName, open.lastName].filter(Boolean).join(" ")}`, 409)
  }
  const lead = await prisma.lead.create({ data: { ...data, createdByName: guard.session.user.name ?? null } })
  return NextResponse.json({ id: lead.id }, { status: 201 })
}
