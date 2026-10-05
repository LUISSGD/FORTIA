import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireClient, jsonError, num, str } from "@/lib/coaching/auth"
import { todayYmd } from "@/lib/coaching/dates"
import { LEVELS } from "@/lib/coaching/constants"
import { getLatestWeight } from "@/lib/coaching/client-data"
import { notifyCoach } from "@/lib/coaching/notify"

const inRange = (v: number | null, min: number, max: number) => v === null || (v >= min && v <= max)

/**
 * El cliente completa o corrige sus datos personales desde la app.
 * Solo se actualizan los campos enviados; un campo vacío ("") lo borra.
 */
export async function PATCH(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const { clientId } = guard
  const b = await request.json()
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k)

  // ── Datos de la ficha del cliente (Client) ──
  const client: { phone?: string | null; birthDate?: Date | null } = {}
  if (has("phone")) {
    const phone = str(b.phone)
    if (phone && !/^[+\d][\d\s-]{5,19}$/.test(phone)) return jsonError("Teléfono inválido")
    client.phone = phone
  }
  if (has("birthDate")) {
    const d = str(b.birthDate)
    if (d) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return jsonError("Fecha de nacimiento inválida")
      const year = Number(d.slice(0, 4))
      const thisYear = Number(todayYmd().slice(0, 4))
      if (year < 1920 || year > thisYear - 10) return jsonError("Revisa tu fecha de nacimiento")
      client.birthDate = new Date(`${d}T12:00:00Z`)
    } else client.birthDate = null
  }

  // ── Datos de coaching (CoachingProfile) ──
  const profile: Record<string, unknown> = {}
  if (has("goal")) profile.goal = str(b.goal)?.slice(0, 80) ?? null
  if (has("level")) {
    const level = str(b.level)
    if (level && !(level in LEVELS)) return jsonError("Nivel inválido")
    profile.level = level
  }
  if (has("sex")) {
    const sex = str(b.sex)
    if (sex && sex !== "M" && sex !== "F") return jsonError("Sexo inválido")
    profile.sex = sex
  }
  if (has("heightCm")) {
    const h = num(b.heightCm)
    if (!inRange(h, 100, 230)) return jsonError("La altura debe estar entre 100 y 230 cm")
    profile.heightCm = h
  }
  if (has("targetWeight")) {
    const w = num(b.targetWeight)
    if (!inRange(w, 30, 250)) return jsonError("El peso objetivo debe estar entre 30 y 250 kg")
    profile.targetWeight = w
  }
  if (has("trainingDays")) {
    const d = num(b.trainingDays)
    if (d === null || !Number.isInteger(d) || d < 1 || d > 7) return jsonError("Días por semana: entre 1 y 7")
    profile.trainingDays = d
  }
  if (has("injuries")) profile.injuries = str(b.injuries)?.slice(0, 500) ?? null

  // ── Peso actual: se registra como medida de hoy (si cambió) ──
  const weight = has("currentWeight") ? num(b.currentWeight) : null
  if (!inRange(weight, 30, 250)) return jsonError("El peso debe estar entre 30 y 250 kg")

  const existing = await prisma.coachingProfile.findUnique({ where: { clientId }, select: { id: true, startWeight: true } })
  const latest = weight !== null ? await getLatestWeight(clientId) : null

  await prisma.$transaction(async (tx) => {
    if (Object.keys(client).length) await tx.client.update({ where: { id: clientId }, data: client })
    if (existing && (Object.keys(profile).length || (weight !== null && existing.startWeight === null))) {
      await tx.coachingProfile.update({
        where: { clientId },
        data: { ...profile, ...(weight !== null && existing.startWeight === null ? { startWeight: weight } : {}) },
      })
    }
    if (weight !== null && latest?.current !== weight) {
      await tx.physicalRecord.create({ data: { clientId, date: new Date(`${todayYmd()}T12:00:00Z`), weight, notes: "Actualizado por el cliente" } })
    }
  })

  const who = await prisma.client.findUnique({ where: { id: clientId }, select: { firstName: true, lastName: true } })
  await notifyCoach({
    clientId,
    type: "PROFILE",
    title: `${who?.firstName ?? "Un cliente"} actualizó sus datos`,
    body: "Revisa su ficha para ver la información nueva.",
    link: `/coaching/clients/${clientId}?tab=summary`,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
