import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, num, str } from "@/lib/coaching/auth"

type Params = { params: Promise<{ id: string }> }

const PROFILE_NUM = ["heightCm", "startWeight", "targetWeight", "trainingDays", "calTarget", "proteinTarget", "carbsTarget", "fatTarget", "waterTargetMl", "price", "billingDay"] as const
const PROFILE_STR = ["status", "goal", "level", "sex", "planName", "currency", "coachNotes", "injuries"] as const
const INT_FIELDS = new Set(["trainingDays", "calTarget", "proteinTarget", "carbsTarget", "fatTarget", "waterTargetMl", "billingDay"])

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id: clientId } = await params
  const body = await request.json()

  const data: Record<string, unknown> = {}
  for (const k of PROFILE_NUM) if (k in body) {
    const v = num(body[k])
    data[k] = v !== null && INT_FIELDS.has(k) ? Math.round(v) : v
  }
  for (const k of PROFILE_STR) if (k in body) data[k] = str(body[k])
  if ("trainingDays" in data && data.trainingDays === null) delete data.trainingDays
  if ("waterTargetMl" in data && data.waterTargetMl === null) delete data.waterTargetMl
  if ("billingDay" in data && data.billingDay === null) delete data.billingDay
  if (data.status === null) delete data.status
  if (data.status !== undefined && !["ACTIVE", "PAUSED", "STANDBY"].includes(data.status as string)) delete data.status
  if (data.currency === null) delete data.currency
  if (body.startDate) data.startDate = new Date(`${body.startDate}T12:00:00Z`)

  const clientData: Record<string, unknown> = {}
  // Stand-by (ex cliente) = inactivo en FORTIA; activo o pausado = activo.
  if (typeof data.status === "string") clientData.isActive = data.status !== "STANDBY"
  if ("phone" in body) clientData.phone = str(body.phone)
  if ("email" in body) clientData.email = str(body.email)
  if ("birthDate" in body) clientData.birthDate = body.birthDate ? new Date(`${body.birthDate}T12:00:00Z`) : null

  const [profile] = await prisma.$transaction([
    prisma.coachingProfile.update({ where: { clientId }, data }),
    ...(Object.keys(clientData).length ? [prisma.client.update({ where: { id: clientId }, data: clientData })] : []),
  ])
  return NextResponse.json(profile)
}

/** Quita al cliente del programa de coaching (conserva su historial) y revoca el acceso a la app. */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id: clientId } = await params
  await prisma.$transaction([
    prisma.coachingProfile.update({ where: { clientId }, data: { status: "ENDED" } }),
    prisma.user.deleteMany({ where: { clientId, role: "CLIENT" } }),
  ])
  return NextResponse.json({ ok: true })
}
