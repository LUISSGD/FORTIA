import { prisma } from "@/lib/prisma"
import { addDaysYmd, diffDaysYmd, todayYmd, toYmd, weekStartYmd } from "./dates"
import { attendedClassDates, attendedPtDates, membershipInfo, type MembershipInfo } from "./personal-training"

export type AlertLevel = "red" | "yellow" | "green"
export type ClientAlert = { level: "red" | "yellow"; text: string }

export type ClientOverview = {
  id: string
  name: string
  firstName: string
  phone: string | null
  email: string | null
  status: string
  goal: string | null
  startDate: string
  lastWorkout: string | null
  daysSinceWorkout: number | null
  workoutsLast7: number
  workoutsThisWeek: number
  trainingDays: number
  trainingAdherence: number | null
  nutritionCompliance: number | null
  lastCheckIn: string | null
  checkInThisWeek: boolean
  lastWeight: number | null
  unreadMessages: number
  pendingPayment: { period: string; amount: number; overdueDays: number } | null
  membership: MembershipInfo
  /** Estado de pago combinando cobros de coaching y membresía del gimnasio. */
  payState: "ok" | "soon" | "pending" | "overdue" | "none"
  ptSessionsLast7: number
  alerts: ClientAlert[]
  level: AlertLevel
}

const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : null)

/** Resumen de todos los clientes de coaching para el dashboard del entrenador. */
export async function getClientsOverview(): Promise<ClientOverview[]> {
  const today = todayYmd()
  const since30 = addDaysYmd(today, -30)
  const since7 = addDaysYmd(today, -7)
  const weekStart = weekStartYmd(today)

  const profiles = await prisma.coachingProfile.findMany({
    where: { status: { not: "ENDED" } },
    include: { client: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, membershipStart: true, membershipEnd: true, membershipPlan: { select: { name: true } } } } },
    orderBy: { client: { firstName: "asc" } },
  })
  const ids = profiles.map((p) => p.clientId)
  if (!ids.length) return []

  const [lastWorkouts, workouts30, activePlans, mealLogs7, checkIns, weights, pendingPayments, unread, ptDates, classDates] = await Promise.all([
    prisma.workoutLog.groupBy({ by: ["clientId"], where: { clientId: { in: ids }, completedAt: { not: null } }, _max: { date: true } }),
    prisma.workoutLog.findMany({ where: { clientId: { in: ids }, completedAt: { not: null }, date: { gte: since30 } }, select: { clientId: true, date: true } }),
    prisma.mealPlan.findMany({ where: { clientId: { in: ids }, isActive: true }, select: { clientId: true, _count: { select: { meals: true } } } }),
    prisma.mealLog.groupBy({ by: ["clientId"], where: { clientId: { in: ids }, status: "DONE", mealId: { not: null }, date: { gte: since7, lt: today } }, _count: { _all: true } }),
    prisma.checkIn.findMany({ where: { clientId: { in: ids } }, select: { clientId: true, weekStart: true, weight: true, createdAt: true }, orderBy: { weekStart: "desc" } }),
    prisma.physicalRecord.findMany({ where: { clientId: { in: ids }, weight: { not: null } }, select: { clientId: true, date: true, weight: true }, orderBy: { date: "desc" } }),
    prisma.coachingPayment.findMany({ where: { clientId: { in: ids }, status: "PENDING" }, orderBy: { dueDate: "asc" } }),
    prisma.coachMessage.groupBy({ by: ["clientId"], where: { clientId: { in: ids }, sender: "CLIENT", readAt: null }, _count: { _all: true } }),
    attendedPtDates(ids, since30),
    attendedClassDates(ids, since30),
  ])

  return profiles.map((p) => {
    const cid = p.clientId
    const startDate = toYmd(p.startDate)
    const daysActive = Math.max(0, diffDaysYmd(today, startDate))
    // Las clases personalizadas y grupales asistidas cuentan como sesiones de entrenamiento (una por día).
    const appWorkouts = workouts30.filter((w) => w.clientId === cid)
    const appDates = new Set(appWorkouts.map((w) => w.date))
    const myPt = [...new Set([...(ptDates.get(cid) ?? []), ...(classDates.get(cid) ?? [])])].filter((d) => !appDates.has(d))
    const myWorkouts = [...appWorkouts, ...myPt.map((date) => ({ clientId: cid, date }))]
    const lastWorkout = [lastWorkouts.find((w) => w.clientId === cid)?._max.date ?? null, ...myPt].reduce<string | null>((a, b) => (b && (!a || b > a) ? b : a), null)
    const ptSessionsLast7 = (ptDates.get(cid) ?? []).filter((d) => d > since7).length
    const workoutsLast7 = myWorkouts.filter((w) => w.date > since7).length
    const workoutsThisWeek = myWorkouts.filter((w) => w.date >= weekStart).length
    const daysSinceWorkout = lastWorkout ? diffDaysYmd(today, lastWorkout) : daysActive

    const trainingAdherence = daysActive >= 7 ? pct(workoutsLast7, p.trainingDays) : pct(workoutsLast7, Math.max(1, Math.round((p.trainingDays * daysActive) / 7)))

    const mealsPerDay = activePlans.find((m) => m.clientId === cid)?._count.meals ?? 0
    const nutritionDays = Math.min(7, daysActive)
    const mealsDone = mealLogs7.find((m) => m.clientId === cid)?._count._all ?? 0
    const nutritionCompliance = mealsPerDay && nutritionDays ? pct(mealsDone, mealsPerDay * nutritionDays) : null

    const myCheckIns = checkIns.filter((c) => c.clientId === cid)
    const lastCheckIn = myCheckIns[0]?.weekStart ?? null
    const checkInThisWeek = lastCheckIn === weekStart
    const checkInRecent = myCheckIns.some((c) => diffDaysYmd(today, toYmd(c.createdAt)) <= 8)

    const weightPoints = [
      ...weights.filter((w) => w.clientId === cid).map((w) => ({ date: toYmd(w.date), weight: w.weight! })),
      ...myCheckIns.filter((c) => c.weight).map((c) => ({ date: toYmd(c.createdAt), weight: c.weight! })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1))
    const lastWeight = weightPoints[0]?.weight ?? null

    const pay = pendingPayments.find((x) => x.clientId === cid)
    const overdueDays = pay ? diffDaysYmd(today, toYmd(pay.dueDate)) : 0
    const pendingPayment = pay ? { period: pay.period, amount: pay.amount, overdueDays } : null

    const alerts: ClientAlert[] = []
    if (p.status === "ACTIVE") {
      if (daysSinceWorkout >= 5) alerts.push({ level: "red", text: `${daysSinceWorkout} días sin entrenar` })
      else if (daysSinceWorkout >= 3 && workoutsLast7 < p.trainingDays) alerts.push({ level: "yellow", text: `${daysSinceWorkout} días sin entrenar` })

      if (nutritionCompliance !== null && nutritionDays >= 3) {
        if (nutritionCompliance < 45) alerts.push({ level: "red", text: `Cumplimiento nutricional ${nutritionCompliance}%` })
        else if (nutritionCompliance < 65) alerts.push({ level: "yellow", text: `Cumplimiento nutricional ${nutritionCompliance}%` })
      }

      if (daysActive > 7 && !checkInRecent) alerts.push({ level: "yellow", text: "No realizó check-in" })

      const recent = weightPoints.filter((w) => diffDaysYmd(today, w.date) <= 21)
      if (recent.length >= 2 && diffDaysYmd(recent[0].date, recent[recent.length - 1].date) >= 14) {
        const ws = recent.map((r) => r.weight)
        const wantsChange = /grasa|m[uú]sculo|hipertrofia|recomposici/i.test(p.goal ?? "")
        if (wantsChange && Math.max(...ws) - Math.min(...ws) < 0.5) alerts.push({ level: "yellow", text: "Peso estancado 3 semanas" })
      }
    }
    const membership = membershipInfo(p.client)
    const tracked = p.status === "ACTIVE" || p.status === "PAUSED"
    if (tracked && membership.daysLeft !== null) {
      if (membership.daysLeft < 0) alerts.push({ level: "red", text: `Membresía vencida hace ${-membership.daysLeft} día${membership.daysLeft === -1 ? "" : "s"}` })
      else if (membership.daysLeft <= 5) alerts.push({ level: "yellow", text: membership.daysLeft === 0 ? "Membresía vence hoy" : `Membresía vence en ${membership.daysLeft} día${membership.daysLeft === 1 ? "" : "s"}` })
    }
    if (tracked && pendingPayment && overdueDays > 0) {
      alerts.push({ level: overdueDays > 5 ? "red" : "yellow", text: `Pago vencido hace ${overdueDays} día${overdueDays === 1 ? "" : "s"}` })
    }

    const level: AlertLevel = alerts.some((a) => a.level === "red") || alerts.length >= 3 ? "red" : alerts.length ? "yellow" : "green"

    return {
      id: cid,
      name: `${p.client.firstName} ${p.client.lastName}`,
      firstName: p.client.firstName,
      phone: p.client.phone,
      email: p.client.email,
      status: p.status,
      goal: p.goal,
      startDate,
      lastWorkout,
      daysSinceWorkout: lastWorkout ? daysSinceWorkout : null,
      workoutsLast7,
      workoutsThisWeek,
      membership,
      payState: pendingPayment
        ? overdueDays > 0 ? "overdue" : "pending"
        : membership.state === "expired" ? "overdue"
        : membership.state === "urgent" ? "soon"
        : membership.state === "none" ? "none" : "ok",
      ptSessionsLast7,
      trainingDays: p.trainingDays,
      trainingAdherence,
      nutritionCompliance,
      lastCheckIn,
      checkInThisWeek,
      lastWeight,
      unreadMessages: unread.find((u) => u.clientId === cid)?._count._all ?? 0,
      pendingPayment,
      alerts,
      level,
    }
  })
}

// ── Retos ────────────────────────────────────────────────────────────

export type ChallengeLike = { metric: string; target: number; startDate: string; endDate: string }

/** Progreso de cada cliente en un reto (clientId → valor). */
export async function challengeProgress(ch: ChallengeLike, clientIds: string[]): Promise<Map<string, number>> {
  const range = { gte: ch.startDate, lte: ch.endDate }
  const result = new Map<string, number>(clientIds.map((id) => [id, 0]))
  if (!clientIds.length) return result

  if (ch.metric === "WORKOUTS") {
    const rows = await prisma.workoutLog.groupBy({ by: ["clientId"], where: { clientId: { in: clientIds }, completedAt: { not: null }, date: range }, _count: { _all: true } })
    rows.forEach((r) => result.set(r.clientId, r._count._all))
  } else if (ch.metric === "MEALS") {
    const rows = await prisma.mealLog.groupBy({ by: ["clientId"], where: { clientId: { in: clientIds }, status: "DONE", date: range }, _count: { _all: true } })
    rows.forEach((r) => result.set(r.clientId, r._count._all))
  } else if (ch.metric === "ACTIVE_DAYS") {
    const [w, m] = await Promise.all([
      prisma.workoutLog.findMany({ where: { clientId: { in: clientIds }, completedAt: { not: null }, date: range }, select: { clientId: true, date: true } }),
      prisma.mealLog.findMany({ where: { clientId: { in: clientIds }, status: "DONE", date: range }, select: { clientId: true, date: true } }),
    ])
    const sets = new Map<string, Set<string>>()
    ;[...w, ...m].forEach((r) => {
      if (!sets.has(r.clientId)) sets.set(r.clientId, new Set())
      sets.get(r.clientId)!.add(r.date)
    })
    sets.forEach((s, id) => result.set(id, s.size))
  } else if (ch.metric === "WATER_DAYS") {
    const [rows, profiles] = await Promise.all([
      prisma.waterLog.groupBy({ by: ["clientId", "date"], where: { clientId: { in: clientIds }, date: range }, _sum: { ml: true } }),
      prisma.coachingProfile.findMany({ where: { clientId: { in: clientIds } }, select: { clientId: true, waterTargetMl: true } }),
    ])
    rows.forEach((r) => {
      const target = profiles.find((p) => p.clientId === r.clientId)?.waterTargetMl ?? 2500
      if ((r._sum.ml ?? 0) >= target) result.set(r.clientId, (result.get(r.clientId) ?? 0) + 1)
    })
  }
  return result
}

// ── Logros ───────────────────────────────────────────────────────────

export type Achievement = { key: string; emoji: string; title: string; description: string; unlocked: boolean }

export async function clientAchievements(clientId: string): Promise<{ achievements: Achievement[]; streak: number; totalWorkouts: number }> {
  const today = todayYmd()
  const [workouts, mealDays, checkIns, photos, waterDays, profile] = await Promise.all([
    prisma.workoutLog.findMany({ where: { clientId, completedAt: { not: null } }, select: { date: true, volumeKg: true } }),
    prisma.mealLog.findMany({ where: { clientId, status: "DONE" }, select: { date: true }, distinct: ["date"] }),
    prisma.checkIn.count({ where: { clientId } }),
    prisma.progressPhoto.count({ where: { clientId } }),
    prisma.waterLog.groupBy({ by: ["date"], where: { clientId }, _sum: { ml: true } }),
    prisma.coachingProfile.findUnique({ where: { clientId }, select: { waterTargetMl: true } }),
  ])

  const activeDays = new Set([...workouts.map((w) => w.date), ...mealDays.map((m) => m.date)])
  let streak = 0
  let cursor = activeDays.has(today) ? today : addDaysYmd(today, -1)
  while (activeDays.has(cursor)) {
    streak++
    cursor = addDaysYmd(cursor, -1)
  }

  const totalVolume = workouts.reduce((a, w) => a + w.volumeKg, 0)
  const waterGoalDays = waterDays.filter((d) => (d._sum.ml ?? 0) >= (profile?.waterTargetMl ?? 2500)).length
  const n = workouts.length

  const achievements: Achievement[] = [
    { key: "first", emoji: "🏁", title: "Primer paso", description: "Completa tu primer entrenamiento", unlocked: n >= 1 },
    { key: "w10", emoji: "💪", title: "Constancia", description: "10 entrenamientos completados", unlocked: n >= 10 },
    { key: "w25", emoji: "🔥", title: "Imparable", description: "25 entrenamientos completados", unlocked: n >= 25 },
    { key: "w50", emoji: "🏆", title: "Élite FORTIA", description: "50 entrenamientos completados", unlocked: n >= 50 },
    { key: "streak7", emoji: "⚡", title: "Racha de 7 días", description: "7 días seguidos activo", unlocked: streak >= 7 },
    { key: "vol10k", emoji: "🏋️", title: "10 toneladas", description: "10.000 kg de volumen acumulado", unlocked: totalVolume >= 10_000 },
    { key: "water7", emoji: "💧", title: "Hidratado", description: "7 días cumpliendo tu meta de agua", unlocked: waterGoalDays >= 7 },
    { key: "checkin4", emoji: "📝", title: "Comprometido", description: "4 check-ins semanales", unlocked: checkIns >= 4 },
    { key: "photos", emoji: "📸", title: "Antes y después", description: "Sube tus primeras fotos de progreso", unlocked: photos >= 1 },
  ]
  return { achievements, streak, totalWorkouts: n }
}
