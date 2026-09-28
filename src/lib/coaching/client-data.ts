import { prisma } from "@/lib/prisma"
import { todayYmd, weekdayYmd, weekStartYmd } from "./dates"
import { nextProgramDay } from "./workout"
import { optionMacros, roundMacros, sumMacros, type Macros } from "./nutrition"

/** Programa activo del cliente + día sugerido para hoy + semana/día en curso. */
export async function getTrainingState(clientId: string) {
  const program = await prisma.program.findFirst({
    where: { clientId, isActive: true, isTemplate: false },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: { exercises: { orderBy: { order: "asc" }, include: { exercise: true } } },
      },
    },
  })
  const today = todayYmd()
  const lastInProgram = program
    ? await prisma.workoutLog.findFirst({
        where: { clientId, completedAt: { not: null }, programDayId: { in: program.days.map((d) => d.id) } },
        orderBy: { startedAt: "desc" },
        select: { programDayId: true, date: true },
      })
    : null
  const doneInProgram = program
    ? await prisma.workoutLog.count({ where: { clientId, completedAt: { not: null }, programDayId: { in: program.days.map((d) => d.id) } } })
    : 0
  const doneToday = await prisma.workoutLog.findFirst({ where: { clientId, date: today, completedAt: { not: null } }, orderBy: { startedAt: "desc" } })
  const nextDay = program ? nextProgramDay(program.days, lastInProgram?.programDayId ?? null, weekdayYmd(today)) : null
  const daysCount = program?.days.length ?? 0
  const week = daysCount ? Math.floor(doneInProgram / daysCount) + 1 : 1
  const dayIndex = nextDay && program ? program.days.findIndex((d) => d.id === nextDay.id) + 1 : 1
  const weekWorkouts = await prisma.workoutLog.count({ where: { clientId, completedAt: { not: null }, date: { gte: weekStartYmd(today) } } })
  return { program, nextDay, doneToday, week, dayIndex, weekWorkouts }
}

/** Plan nutricional activo, registros del día y totales. */
export async function getNutritionDay(clientId: string, date: string = todayYmd()) {
  const [plan, profile, logs, water] = await Promise.all([
    prisma.mealPlan.findFirst({
      where: { clientId, isActive: true, isTemplate: false },
      include: {
        meals: {
          orderBy: { order: "asc" },
          include: { options: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" }, include: { food: true } } } } },
        },
      },
    }),
    prisma.coachingProfile.findUnique({ where: { clientId } }),
    prisma.mealLog.findMany({ where: { clientId, date }, orderBy: { createdAt: "asc" } }),
    prisma.waterLog.aggregate({ where: { clientId, date }, _sum: { ml: true } }),
  ])
  const consumed: Macros = roundMacros(sumMacros(logs.filter((l) => l.status === "DONE").map((l) => ({ kcal: l.kcal, protein: l.protein, carbs: l.carbs, fat: l.fat }))))
  const planDefault = plan ? roundMacros(sumMacros(plan.meals.map((m) => (m.options[0] ? optionMacros(m.options[0]) : { kcal: 0, protein: 0, carbs: 0, fat: 0 })))) : null
  const targets: Macros = {
    kcal: profile?.calTarget ?? plan?.calTarget ?? planDefault?.kcal ?? 0,
    protein: profile?.proteinTarget ?? plan?.proteinTarget ?? planDefault?.protein ?? 0,
    carbs: profile?.carbsTarget ?? plan?.carbsTarget ?? planDefault?.carbs ?? 0,
    fat: profile?.fatTarget ?? plan?.fatTarget ?? planDefault?.fat ?? 0,
  }
  return { plan, logs, consumed, targets, waterMl: water._sum.ml ?? 0, waterTargetMl: profile?.waterTargetMl ?? 2500 }
}

export async function getLatestWeight(clientId: string) {
  const [last, first] = await Promise.all([
    prisma.physicalRecord.findFirst({ where: { clientId, weight: { not: null } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], select: { weight: true, date: true } }),
    prisma.physicalRecord.findFirst({ where: { clientId, weight: { not: null } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], select: { weight: true } }),
  ])
  return { current: last?.weight ?? null, start: first?.weight ?? null, date: last?.date ?? null }
}
