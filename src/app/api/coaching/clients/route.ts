import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError, num, str } from "@/lib/coaching/auth"
import { getClientsOverview } from "@/lib/coaching/stats"

export async function GET() {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  return NextResponse.json(await getClientsOverview())
}

/** Da de alta un cliente de coaching: a partir de un cliente existente del gimnasio o creando uno nuevo. */
export async function POST(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const body = await request.json()

  let clientId: string | null = str(body.clientId)
  if (!clientId) {
    const firstName = str(body.firstName)
    const lastName = str(body.lastName)
    if (!firstName || !lastName) return jsonError("Nombre y apellido son obligatorios")
    const client = await prisma.client.create({
      data: {
        firstName,
        lastName,
        email: str(body.email),
        phone: str(body.phone),
        birthDate: body.birthDate ? new Date(`${body.birthDate}T12:00:00Z`) : null,
        notes: "Cliente de coaching",
      },
    })
    clientId = client.id
  }

  const existing = await prisma.coachingProfile.findUnique({ where: { clientId } })
  if (existing) {
    if (existing.status === "ENDED") {
      const reactivated = await prisma.coachingProfile.update({ where: { clientId }, data: { status: "ACTIVE", startDate: new Date() } })
      return NextResponse.json(reactivated)
    }
    return jsonError("Este cliente ya está en coaching")
  }

  const profile = await prisma.coachingProfile.create({
    data: {
      clientId,
      goal: str(body.goal),
      level: str(body.level),
      sex: str(body.sex),
      heightCm: num(body.heightCm),
      startWeight: num(body.startWeight),
      targetWeight: num(body.targetWeight),
      trainingDays: num(body.trainingDays) ?? 4,
      planName: str(body.planName) ?? "Coaching Premium",
      price: num(body.price),
      currency: str(body.currency) ?? "PEN",
      billingDay: num(body.billingDay) ?? 1,
    },
  })

  if (profile.startWeight) {
    await prisma.physicalRecord.create({ data: { clientId, date: new Date(), weight: profile.startWeight, height: profile.heightCm } })
  }
  return NextResponse.json(profile, { status: 201 })
}
