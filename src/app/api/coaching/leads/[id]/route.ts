import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError } from "@/lib/coaching/auth"
import { parseLeadInput } from "@/lib/coaching/leads"

type Ctx = { params: Promise<{ id: string }> }

/** Edita al interesado, lo mueve de etapa o registra que ya se le escribió (`contacted: true`). */
export async function PATCH(request: Request, { params }: Ctx) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const r = parseLeadInput(body, true)
  if ("error" in r) return jsonError(r.error ?? "Datos inválidos")
  const lead = await prisma.lead.findUnique({ where: { id }, select: { stage: true } })
  if (!lead) return jsonError("Interesado no encontrado", 404)
  const data = r.data as Record<string, unknown>
  if (body.contacted === true && lead.stage === "NEW" && !("stage" in data)) data.stage = "CONTACTED"
  await prisma.lead.update({ where: { id }, data })
  return NextResponse.json({ ok: true })
}

/** Borra los datos del interesado (por ejemplo, si pide que se eliminen). */
export async function DELETE(_request: Request, { params }: Ctx) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  await prisma.lead.deleteMany({ where: { id } })
  return NextResponse.json({ ok: true })
}
