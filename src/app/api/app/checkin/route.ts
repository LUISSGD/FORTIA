import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireClient, jsonError, num, str } from "@/lib/coaching/auth"
import { todayYmd, weekStartYmd } from "@/lib/coaching/dates"
import { ADHERENCE_OPTIONS, SLEEP_OPTIONS } from "@/lib/coaching/constants"
import { notifyCoach } from "@/lib/coaching/notify"

/** Envía (o corrige) el check-in de la semana actual. */
export async function POST(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const { clientId } = guard
  const b = await request.json()
  const energy = num(b.energy)
  if (!energy || energy < 1 || energy > 5) return jsonError("Indica tu nivel de energía")
  if (!ADHERENCE_OPTIONS.some((o) => o.value === b.nutritionAdherence)) return jsonError("Indica tu cumplimiento de alimentación")
  if (!SLEEP_OPTIONS.some((o) => o.value === b.sleep)) return jsonError("Indica cuánto dormiste")

  const weekStart = weekStartYmd()
  const weight = num(b.weight)
  const stress = num(b.stress)
  const data = {
    energy: Math.round(energy),
    nutritionAdherence: b.nutritionAdherence as string,
    sleep: b.sleep as string,
    stress: stress ? Math.min(5, Math.max(1, Math.round(stress))) : null,
    weight,
    discomfort: str(b.discomfort),
    feelings: str(b.feelings),
  }
  const existing = await prisma.checkIn.findUnique({ where: { clientId_weekStart: { clientId, weekStart } } })
  const checkIn = await prisma.checkIn.upsert({
    where: { clientId_weekStart: { clientId, weekStart } },
    create: { clientId, weekStart, ...data },
    update: data,
  })

  if (weight) {
    const today = new Date(`${todayYmd()}T12:00:00Z`)
    const sameDay = await prisma.physicalRecord.findFirst({ where: { clientId, date: today } })
    if (sameDay) await prisma.physicalRecord.update({ where: { id: sameDay.id }, data: { weight } })
    else await prisma.physicalRecord.create({ data: { clientId, date: today, weight, notes: "Check-in semanal" } })
  }

  if (!existing) {
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { firstName: true } })
    await notifyCoach({
      clientId,
      type: "CHECKIN",
      title: `Check-in de ${client?.firstName}`,
      body: data.discomfort ? `⚠️ Molestia: ${data.discomfort}` : `Energía ${data.energy}/5 · Dieta ${data.nutritionAdherence}%`,
      link: `/coaching/clients/${clientId}?tab=checkins`,
    })
  }
  return NextResponse.json(checkIn, { status: existing ? 200 : 201 })
}
