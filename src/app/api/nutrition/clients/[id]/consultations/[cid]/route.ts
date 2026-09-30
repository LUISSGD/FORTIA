import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { applyConsultationToCoaching, removeConsultationFromCoaching } from "@/lib/coaching/sync-fortia"
import { syncConsultationIncome } from "@/lib/finance-sync"

type Params = { params: Promise<{ id: string; cid: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { cid } = await params
  const consultation = await prisma.nutritionConsultation.findUnique({ where: { id: cid } })
  if (!consultation) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(consultation)
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { cid } = await params
  const body = await request.json()

  // Solo se actualizan los campos enviados (antes, marcar como pagado borraba medidas y metas).
  const numOrNull = (v: unknown) => (v === null || v === "" ? null : Number(v))
  const NUM = ["weight", "height", "bodyFat", "muscleMass", "waist", "hips", "arms", "proteinTarget", "carbsTarget", "fatTarget", "waterTarget", "paymentAmount"] as const
  const INT = ["visceralFat", "calTarget"] as const
  const TEXT = ["goal", "dietPlan", "supplements", "recommendations", "observations", "paymentMethod"] as const
  const data: Record<string, unknown> = {}
  for (const k of NUM) if (k in body) data[k] = numOrNull(body[k])
  for (const k of INT) if (k in body) data[k] = body[k] === null || body[k] === "" ? null : Math.round(Number(body[k]))
  for (const k of TEXT) if (k in body) data[k] = body[k] || null
  if (body.date) data.date = new Date(body.date)
  if ("nextAppointment" in body) data.nextAppointment = body.nextAppointment ? new Date(body.nextAppointment) : null
  if (typeof body.isPaid === "boolean") data.isPaid = body.isPaid

  const consultation = await prisma.nutritionConsultation.update({ where: { id: cid }, data })
  await applyConsultationToCoaching(consultation.id)
  await syncConsultationIncome(consultation.id)
  return NextResponse.json(consultation)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { cid } = await params
  const deleted = await prisma.nutritionConsultation.delete({ where: { id: cid } })
  // Su ingreso en Finanzas se borra con ella.
  if (deleted.incomeId) await prisma.income.deleteMany({ where: { id: deleted.incomeId } })
  await removeConsultationFromCoaching(deleted)
  return NextResponse.json({ ok: true })
}
