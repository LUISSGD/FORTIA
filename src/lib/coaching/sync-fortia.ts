import { prisma } from "@/lib/prisma"
import { GOALS } from "./constants"
import { todayYmd, toYmd } from "./dates"

// Trae al módulo de coaching los datos que ya existen en FORTIA:
// clientes del gimnasio, seguimiento físico y consultas de nutrición.

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim()

function mapGoal(g: string | null | undefined) {
  if (!g) return null
  const k = norm(g)
  if (/grasa|adelgaz|bajar|perder|defin|deficit/.test(k)) return "Perder grasa"
  if (/hipertrof/.test(k)) return "Hipertrofia"
  if (/musculo|volumen|masa|ganar/.test(k)) return "Ganar músculo"
  if (/recompos/.test(k)) return "Recomposición corporal"
  if (/fuerza/.test(k)) return "Fuerza"
  if (/salud|bienestar|mantener|mantenimiento/.test(k)) return "Salud y bienestar"
  return GOALS.find((x) => norm(x) === k) ?? g.slice(0, 60)
}

/** Candidatos: clientes activos del gimnasio con la información que se puede traer de cada uno. */
export async function syncCandidates() {
  const [clients, nutrition] = await Promise.all([
    prisma.client.findMany({
      where: { isActive: true },
      select: {
        id: true, firstName: true, lastName: true, dni: true, phone: true, membershipEnd: true,
        coachingProfile: { select: { status: true } },
        _count: { select: { physicalRecords: true } },
        trainingPlans: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
      },
      orderBy: { firstName: "asc" },
    }),
    prisma.nutritionClient.findMany({ select: { id: true, clientId: true, firstName: true, lastName: true, dni: true, _count: { select: { consultations: true } } } }),
  ])
  const today = todayYmd()
  return clients.map((c) => {
    const nut = findNutrition(c, nutrition)
    return {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      phone: c.phone,
      inCoaching: !!c.coachingProfile && c.coachingProfile.status !== "ENDED",
      measurements: c._count.physicalRecords,
      personalTraining: c.trainingPlans.length > 0,
      consultations: nut?._count.consultations ?? 0,
      membershipEnd: c.membershipEnd ? toYmd(c.membershipEnd) : null,
      membershipActive: !!c.membershipEnd && toYmd(c.membershipEnd) >= today,
    }
  })
}

type NutLite = { id: string; clientId: string | null; firstName: string; lastName: string; dni: string | null }
function findNutrition<T extends NutLite>(c: { id: string; firstName: string; lastName: string; dni: string | null }, list: T[]) {
  return (
    list.find((n) => n.clientId === c.id) ??
    (c.dni ? list.find((n) => n.dni && n.dni === c.dni) : undefined) ??
    list.find((n) => !n.clientId && norm(`${n.firstName} ${n.lastName}`) === norm(`${c.firstName} ${c.lastName}`))
  )
}

export type SyncReport = { clients: number; created: number; updated: number; measurements: number; errors: string[] }

/**
 * Da de alta (o completa) el perfil de coaching de cada cliente con sus datos de FORTIA.
 * No sobrescribe lo que ya tenga el perfil: solo rellena campos vacíos. Es seguro repetirlo.
 */
export async function syncFromFortia(clientIds: string[]): Promise<SyncReport> {
  const report: SyncReport = { clients: 0, created: 0, updated: 0, measurements: 0, errors: [] }
  const nutritionAll = await prisma.nutritionClient.findMany({
    include: { consultations: { orderBy: { date: "asc" } } },
  })

  for (const clientId of clientIds) {
    try {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: { coachingProfile: true, physicalRecords: { orderBy: { date: "asc" } } },
      })
      if (!client) continue
      report.clients++
      const nut = findNutrition(client, nutritionAll)
      const consults = nut?.consultations ?? []
      const last = [...consults].reverse()
      const lastWith = <K extends keyof (typeof consults)[number]>(k: K) => last.find((c) => c[k] !== null && c[k] !== undefined)?.[k] ?? null

      // Medidas de las consultas de nutrición → seguimiento físico (sin duplicar fechas)
      const existingDates = new Set(client.physicalRecords.map((r) => r.date.toISOString().slice(0, 10)))
      for (const c of consults) {
        const day = c.date.toISOString().slice(0, 10)
        if (existingDates.has(day)) continue
        if ([c.weight, c.bodyFat, c.waist, c.hips, c.arms].every((v) => v === null)) continue
        await prisma.physicalRecord.create({
          data: { clientId, date: new Date(`${day}T12:00:00Z`), weight: c.weight, height: c.height, bodyFat: c.bodyFat, waist: c.waist, hips: c.hips, arms: c.arms, notes: `Consulta de nutrición #${c.consultationNumber}` },
        })
        existingDates.add(day)
        report.measurements++
      }

      const records = await prisma.physicalRecord.findMany({ where: { clientId }, orderBy: { date: "asc" } })
      const firstWeight = records.find((r) => r.weight !== null)?.weight ?? null
      const lastHeight = [...records].reverse().find((r) => r.height !== null)?.height ?? lastWith("height")

      const notes = [
        nut?.medicalConditions && `Condiciones médicas: ${nut.medicalConditions}`,
        nut?.allergies && `Alergias: ${nut.allergies}`,
      ].filter(Boolean).join("\n")
      const coachNotes = [
        nut?.foodPreferences && `Preferencias alimentarias: ${nut.foodPreferences}`,
        nut?.physicalActivityLevel && `Actividad física: ${nut.physicalActivityLevel}`,
        lastWith("supplements") && `Suplementos: ${lastWith("supplements")}`,
        lastWith("dietPlan") && `Último plan de dieta (nutrición):\n${lastWith("dietPlan")}`,
        lastWith("recommendations") && `Recomendaciones: ${lastWith("recommendations")}`,
      ].filter(Boolean).join("\n\n")

      const water = lastWith("waterTarget") as number | null
      const fill = {
        goal: mapGoal((lastWith("goal") as string | null) ?? nut?.currentGoal),
        sex: nut?.gender === "M" || nut?.gender === "F" ? nut.gender : null,
        heightCm: lastHeight as number | null,
        startWeight: firstWeight,
        calTarget: lastWith("calTarget") as number | null,
        proteinTarget: lastWith("proteinTarget") !== null ? Math.round(lastWith("proteinTarget") as number) : null,
        carbsTarget: lastWith("carbsTarget") !== null ? Math.round(lastWith("carbsTarget") as number) : null,
        fatTarget: lastWith("fatTarget") !== null ? Math.round(lastWith("fatTarget") as number) : null,
        waterTargetMl: water ? Math.round(water < 20 ? water * 1000 : water) : null,
        injuries: notes || null,
        coachNotes: coachNotes || null,
      }

      const p = client.coachingProfile
      if (!p) {
        await prisma.coachingProfile.create({
          data: {
            clientId,
            ...Object.fromEntries(Object.entries(fill).filter(([, v]) => v !== null && v !== undefined)),
            startDate: new Date(),
          },
        })
        report.created++
      } else {
        const patch = Object.fromEntries(
          Object.entries(fill).filter(([k, v]) => v !== null && v !== undefined && (k === "waterTargetMl" ? p.waterTargetMl === 2500 : (p as Record<string, unknown>)[k] === null))
        )
        await prisma.coachingProfile.update({ where: { clientId }, data: { ...patch, ...(p.status === "ENDED" ? { status: "ACTIVE" } : {}) } })
        report.updated++
      }

      // Datos de contacto del cliente que falten
      const contact: Record<string, unknown> = {}
      if (!client.email && nut?.email) contact.email = nut.email
      if (!client.phone && nut?.phone) contact.phone = nut.phone
      if (!client.birthDate && nut?.birthDate) contact.birthDate = nut.birthDate
      if (Object.keys(contact).length) await prisma.client.update({ where: { id: clientId }, data: contact })
      if (nut && !nut.clientId) await prisma.nutritionClient.update({ where: { id: nut.id }, data: { clientId } })
    } catch (e) {
      console.error("syncFromFortia", clientId, e)
      report.errors.push(`${clientId}: ${(e as Error).message.slice(0, 120)}`)
    }
  }
  return report
}

/**
 * Una consulta de nutrición nueva o editada en FORTIA se refleja en el coaching del cliente:
 * sus medidas pasan al seguimiento físico y sus metas (kcal, macros, agua, objetivo)
 * pasan a ser las metas del perfil de coaching. Nunca lanza error (no bloquea la consulta).
 */
export async function applyConsultationToCoaching(consultationId: string) {
  try {
    const c = await prisma.nutritionConsultation.findUnique({
      where: { id: consultationId },
      include: { nutritionClient: true },
    })
    if (!c) return
    let clientId = c.nutritionClient.clientId
    if (!clientId && c.nutritionClient.dni) {
      // Paciente de nutrición sin vincular: se busca al cliente del gimnasio por DNI.
      const match = await prisma.client.findFirst({ where: { dni: c.nutritionClient.dni }, select: { id: true } })
      if (match) {
        clientId = match.id
        await prisma.nutritionClient.update({ where: { id: c.nutritionClientId }, data: { clientId } })
      }
    }
    if (!clientId) return

    // Medidas → seguimiento físico (un registro por día)
    const day = c.date.toISOString().slice(0, 10)
    const measures = { weight: c.weight, height: c.height, bodyFat: c.bodyFat, waist: c.waist, hips: c.hips, arms: c.arms }
    if (Object.values(measures).some((v) => v !== null)) {
      const date = new Date(`${day}T12:00:00Z`)
      const sameDay = await prisma.physicalRecord.findFirst({
        where: { clientId, date: { gte: new Date(`${day}T00:00:00Z`), lt: new Date(`${day}T23:59:59Z`) } },
      })
      const note = `Consulta de nutrición #${c.consultationNumber}`
      if (!sameDay) {
        await prisma.physicalRecord.create({ data: { clientId, date, ...measures, notes: note } })
      } else if (sameDay.notes === note) {
        await prisma.physicalRecord.update({ where: { id: sameDay.id }, data: measures })
      } else {
        // Ya había un registro ese día: solo se completan los campos vacíos.
        const fill = Object.fromEntries(Object.entries(measures).filter(([k, v]) => v !== null && (sameDay as Record<string, unknown>)[k] === null))
        if (Object.keys(fill).length) await prisma.physicalRecord.update({ where: { id: sameDay.id }, data: fill })
      }
    }

    // Metas de la última consulta → perfil de coaching
    const latest = await prisma.nutritionConsultation.findFirst({ where: { nutritionClientId: c.nutritionClientId }, orderBy: { date: "desc" } })
    if (latest?.id !== c.id) return
    const profile = await prisma.coachingProfile.findUnique({ where: { clientId } })
    if (!profile) return
    const water = c.waterTarget
    const targets = {
      goal: c.goal ? mapGoal(c.goal) : null,
      calTarget: c.calTarget !== null ? Math.round(c.calTarget) : null,
      proteinTarget: c.proteinTarget !== null ? Math.round(c.proteinTarget) : null,
      carbsTarget: c.carbsTarget !== null ? Math.round(c.carbsTarget) : null,
      fatTarget: c.fatTarget !== null ? Math.round(c.fatTarget) : null,
      waterTargetMl: water ? Math.round(water < 20 ? water * 1000 : water) : null,
      heightCm: c.height,
    }
    const data = Object.fromEntries(Object.entries(targets).filter(([, v]) => v !== null && v !== undefined))
    if (Object.keys(data).length) await prisma.coachingProfile.update({ where: { clientId }, data })
  } catch (e) {
    console.error("[nutrición → coaching]", e)
  }
}

/** Al borrar una consulta se quita el registro físico que se creó desde ella. */
export async function removeConsultationFromCoaching(c: { nutritionClientId: string; consultationNumber: number; date: Date }) {
  try {
    const nut = await prisma.nutritionClient.findUnique({ where: { id: c.nutritionClientId }, select: { clientId: true } })
    if (!nut?.clientId) return
    const day = c.date.toISOString().slice(0, 10)
    await prisma.physicalRecord.deleteMany({
      where: { clientId: nut.clientId, notes: `Consulta de nutrición #${c.consultationNumber}`, date: { gte: new Date(`${day}T00:00:00Z`), lt: new Date(`${day}T23:59:59Z`) } },
    })
  } catch (e) {
    console.error("[nutrición → coaching] borrar", e)
  }
}
