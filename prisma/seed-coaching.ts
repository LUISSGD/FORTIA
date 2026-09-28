/**
 * Carga la biblioteca base de coaching (ejercicios + alimentos). No borra nada.
 *   npx tsx prisma/seed-coaching.ts
 *
 * Con --demo además crea clientes de ejemplo con historial (útil para probar la app):
 *   npx tsx prisma/seed-coaching.ts --demo
 *   Login del cliente demo: carlos@demo.fortia.pe / fortia123
 */
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import bcrypt from "bcryptjs"
import "dotenv/config"
import { DEFAULT_EXERCISES } from "../src/lib/coaching/library-exercises"
import { DEFAULT_FOODS } from "../src/lib/coaching/library-foods"

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d)
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

async function library() {
  const ex = await prisma.exercise.createMany({ data: DEFAULT_EXERCISES, skipDuplicates: true })
  const fo = await prisma.food.createMany({ data: DEFAULT_FOODS, skipDuplicates: true })
  console.log(`Biblioteca: +${ex.count} ejercicios, +${fo.count} alimentos`)
}

async function demo() {
  const exId = async (name: string) => (await prisma.exercise.findUniqueOrThrow({ where: { name } })).id
  const foodId = async (name: string) => (await prisma.food.findUniqueOrThrow({ where: { name } })).id

  // Plantilla de rutina PPL
  let template = await prisma.program.findFirst({ where: { isTemplate: true, name: "Push / Pull / Legs — Hipertrofia" } })
  if (!template) {
    const days: [string, number, [string, number, string, number, string?, string?][]][] = [
      ["Lunes — PUSH", 0, [["Press banca", 4, "8-10", 120, "2", "3-1-1"], ["Press inclinado con mancuernas", 3, "10-12", 90, "2"], ["Press militar", 3, "8-10", 90, "2"], ["Elevaciones laterales", 4, "12-15", 60, "1"], ["Extensión de tríceps en polea", 3, "12-15", 60, "1"]]],
      ["Martes — PULL", 1, [["Dominadas", 4, "6-10", 120, "2"], ["Remo con barra", 4, "8-10", 90, "2"], ["Jalón al pecho", 3, "10-12", 90, "2"], ["Face pull", 3, "15", 60, "1"], ["Curl con barra", 3, "10-12", 60, "1"]]],
      ["Jueves — LEGS", 3, [["Sentadilla con barra", 4, "6-8", 150, "2", "3-1-1"], ["Peso muerto rumano", 3, "8-10", 120, "2"], ["Prensa de piernas", 3, "10-12", 90, "2"], ["Curl femoral acostado", 3, "12", 60, "1"], ["Elevación de talones de pie", 4, "12-15", 60, "1"]]],
      ["Viernes — UPPER", 4, [["Press plano con mancuernas", 3, "8-10", 90, "2"], ["Remo con mancuerna", 3, "10", 90, "2"], ["Press de hombros con mancuernas", 3, "10", 90, "2"], ["Curl martillo", 3, "12", 60, "1"], ["Press francés", 3, "12", 60, "1"]]],
    ]
    template = await prisma.program.create({ data: { name: "Push / Pull / Legs — Hipertrofia", goal: "Hipertrofia", level: "INTERMEDIO", weeks: 8, isTemplate: true, description: "Calienta 10 min. Última serie cerca del fallo. Cuando completes todas las reps con buena técnica, sube 2.5 kg." } })
    for (const [i, [name, dow, exs]] of days.entries()) {
      const day = await prisma.programDay.create({ data: { programId: template.id, name, order: i, dayOfWeek: dow } })
      for (const [j, [n, sets, reps, rest, rir, tempo]] of exs.entries()) {
        await prisma.programExercise.create({ data: { dayId: day.id, exerciseId: await exId(n), order: j, sets, reps, restSec: rest, rir: rir ?? null, tempo: tempo ?? null } })
      }
    }
  }

  // Plantilla nutricional
  let mealTemplate = await prisma.mealPlan.findFirst({ where: { isTemplate: true, name: "Recomposición 2000 kcal" } })
  if (!mealTemplate) {
    mealTemplate = await prisma.mealPlan.create({ data: { name: "Recomposición 2000 kcal", isTemplate: true, calTarget: 2000, proteinTarget: 160, carbsTarget: 210, fatTarget: 65, description: "Puedes intercambiar opciones dentro de una misma comida. Verduras libres. Mínimo 2.5 L de agua." } })
    const meals: [string, string, [string, [string, number][]][]][] = [
      ["Desayuno", "07:30", [["Opción A", [["Huevo entero", 150], ["Pan integral", 60], ["Papaya", 150], ["Café negro", 240]]], ["Opción B", [["Avena en hojuelas", 60], ["Proteína whey (polvo)", 30], ["Plátano de seda", 120], ["Leche descremada", 250]]]]],
      ["Almuerzo", "13:00", [["Opción A", [["Pechuga de pollo cocida", 180], ["Arroz blanco cocido", 150], ["Ensalada mixta (lechuga, tomate, pepino)", 150], ["Aceite de oliva", 10]]], ["Opción B", [["Lomo fino de res", 160], ["Papa blanca cocida", 200], ["Brócoli", 100], ["Aceite de oliva", 10]]], ["Opción C", [["Bonito", 180], ["Quinua cocida", 185], ["Verduras salteadas", 150]]]]],
      ["Snack", "17:00", [["Opción A", [["Yogur griego 0%", 150], ["Arándanos", 100], ["Almendras", 20]]], ["Opción B", [["Pan integral", 60], ["Jamón de pavo", 60], ["Palta", 50]]]]],
      ["Cena", "20:30", [["Opción A", [["Tilapia", 180], ["Camote cocido", 150], ["Ensalada mixta (lechuga, tomate, pepino)", 150]]], ["Opción B", [["Omelette de claras con verduras", 300], ["Pan integral", 60], ["Queso fresco", 30]]]]],
    ]
    for (const [i, [name, time, options]] of meals.entries()) {
      const meal = await prisma.meal.create({ data: { planId: mealTemplate.id, name, time, order: i } })
      for (const [j, [label, items]] of options.entries()) {
        const opt = await prisma.mealOption.create({ data: { mealId: meal.id, label, order: j } })
        for (const [k, [food, grams]] of items.entries()) {
          await prisma.mealOptionItem.create({ data: { optionId: opt.id, foodId: await foodId(food), grams, order: k } })
        }
      }
    }
  }

  const people = [
    { firstName: "Carlos", lastName: "Pérez", email: "carlos@demo.fortia.pe", goal: "Recomposición corporal", start: 82.4, now: 79.8, trainEvery: 2, lastTrainedDaysAgo: 5, mealRatio: 0.42, checkins: false },
    { firstName: "Andrea", lastName: "Torres", email: "andrea@demo.fortia.pe", goal: "Perder grasa", start: 68, now: 68, trainEvery: 2, lastTrainedDaysAgo: 1, mealRatio: 0.9, checkins: true },
    { firstName: "Pedro", lastName: "Ramos", email: "pedro@demo.fortia.pe", goal: "Ganar músculo", start: 70, now: 72.1, trainEvery: 2, lastTrainedDaysAgo: 8, mealRatio: 0.7, checkins: true },
    { firstName: "Lucía", lastName: "Vargas", email: "lucia@demo.fortia.pe", goal: "Hipertrofia", start: 58, now: 59.5, trainEvery: 1, lastTrainedDaysAgo: 0, mealRatio: 0.95, checkins: true },
  ]
  const password = await bcrypt.hash("fortia123", 10)
  const today = ymd(new Date())

  for (const p of people) {
    if (await prisma.user.findUnique({ where: { email: p.email } })) {
      console.log(`Demo ${p.firstName} ya existe, se omite`)
      continue
    }
    const client = await prisma.client.create({ data: { firstName: p.firstName, lastName: p.lastName, email: p.email, phone: "999888777", birthDate: new Date("1994-05-12T12:00:00Z"), notes: "Cliente demo de coaching" } })
    await prisma.user.create({ data: { email: p.email, password, name: `${p.firstName} ${p.lastName}`, role: "CLIENT", clientId: client.id } })
    await prisma.coachingProfile.create({
      data: { clientId: client.id, goal: p.goal, level: "INTERMEDIO", sex: p.firstName === "Andrea" || p.firstName === "Lucía" ? "F" : "M", heightCm: 175, startWeight: p.start, targetWeight: p.goal.includes("grasa") || p.goal.includes("Recomp") ? p.start - 6 : p.start + 4, trainingDays: 4, startDate: daysAgo(42), calTarget: 2000, proteinTarget: 160, carbsTarget: 210, fatTarget: 65, price: 600 },
    })

    // Programa y plan asignados (copia de plantillas)
    const tpl = await prisma.program.findUniqueOrThrow({ where: { id: template.id }, include: { days: { include: { exercises: true }, orderBy: { order: "asc" } } } })
    const program = await prisma.program.create({ data: { name: tpl.name, goal: tpl.goal, level: tpl.level, weeks: tpl.weeks, description: tpl.description, clientId: client.id, startDate: daysAgo(42) } })
    const dayIds: { id: string; exercises: { exerciseId: string; sets: number }[] ; name: string }[] = []
    for (const d of tpl.days) {
      const day = await prisma.programDay.create({ data: { programId: program.id, name: d.name, order: d.order, dayOfWeek: d.dayOfWeek } })
      await prisma.programExercise.createMany({ data: d.exercises.map((e) => ({ dayId: day.id, exerciseId: e.exerciseId, order: e.order, sets: e.sets, reps: e.reps, restSec: e.restSec, rir: e.rir, tempo: e.tempo })) })
      dayIds.push({ id: day.id, name: d.name, exercises: d.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets })) })
    }
    const mtpl = await prisma.mealPlan.findUniqueOrThrow({ where: { id: mealTemplate.id }, include: { meals: { include: { options: { include: { items: { include: { food: true } } } } } } } })
    const plan = await prisma.mealPlan.create({ data: { name: mtpl.name, description: mtpl.description, clientId: client.id, calTarget: 2000, proteinTarget: 160, carbsTarget: 210, fatTarget: 65 } })
    const planMeals: { id: string; name: string; optionId: string; macros: { kcal: number; protein: number; carbs: number; fat: number } }[] = []
    for (const m of mtpl.meals) {
      const meal = await prisma.meal.create({ data: { planId: plan.id, name: m.name, time: m.time, order: m.order } })
      for (const o of m.options) {
        const opt = await prisma.mealOption.create({ data: { mealId: meal.id, label: o.label, order: o.order } })
        await prisma.mealOptionItem.createMany({ data: o.items.map((it) => ({ optionId: opt.id, foodId: it.foodId, grams: it.grams, order: it.order })) })
        if (o.order === 0) {
          const macros = o.items.reduce((a, it) => ({ kcal: a.kcal + (it.food!.kcal * it.grams) / 100, protein: a.protein + (it.food!.protein * it.grams) / 100, carbs: a.carbs + (it.food!.carbs * it.grams) / 100, fat: a.fat + (it.food!.fat * it.grams) / 100 }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
          planMeals.push({ id: meal.id, name: m.name, optionId: opt.id, macros })
        }
      }
    }

    // Historial de entrenamientos con progresión (+2.5 kg cada ~semana)
    let session = 0
    for (let d = 40; d >= p.lastTrainedDaysAgo; d -= p.trainEvery) {
      const day = dayIds[session % dayIds.length]
      const week = Math.floor(session / dayIds.length)
      const date = daysAgo(d)
      const sets = day.exercises.flatMap((e, i) =>
        Array.from({ length: e.sets }, (_, s) => ({ exerciseId: e.exerciseId, setNumber: s + 1, weight: 20 + i * 10 + week * 2.5, reps: 8 + (s === e.sets - 1 ? -1 : 0) + (week % 2) }))
      )
      const volume = sets.reduce((a, s) => a + s.weight * s.reps, 0)
      await prisma.workoutLog.create({
        data: { clientId: client.id, programDayId: day.id, dayName: day.name, date: ymd(date), startedAt: new Date(date.getTime() - 3600_000), completedAt: date, durationMin: 55 + (session % 10), volumeKg: volume, rating: 4, sets: { create: sets } },
      })
      session++
    }

    // Comidas registradas (últimos 14 días, excepto hoy)
    for (let d = 14; d >= 1; d--) {
      for (const [i, m] of planMeals.entries()) {
        if ((d * 7 + i * 3) % 100 < p.mealRatio * 100) {
          await prisma.mealLog.create({ data: { clientId: client.id, date: ymd(daysAgo(d)), mealId: m.id, optionId: m.optionId, name: m.name, status: "DONE", ...m.macros } })
        }
      }
      await prisma.waterLog.create({ data: { clientId: client.id, date: ymd(daysAgo(d)), ml: 1500 + ((d * 250) % 1250) } })
    }

    // Peso y medidas semanales
    for (let w = 6; w >= 0; w--) {
      const weight = Math.round((p.now + ((p.start - p.now) * w) / 6) * 10) / 10
      await prisma.physicalRecord.create({ data: { clientId: client.id, date: new Date(`${ymd(daysAgo(w * 7))}T12:00:00Z`), weight, waist: Math.round((84 + w * 0.8) * 10) / 10, chest: 102 + (6 - w) * 0.3, arms: 35 + (6 - w) * 0.15 } })
    }

    // Check-ins
    if (p.checkins) {
      for (let w = 3; w >= 1; w--) {
        const monday = new Date(`${ymd(daysAgo(w * 7))}T12:00:00Z`)
        const ws = ymd(new Date(monday.getTime() - ((monday.getUTCDay() + 6) % 7) * 86_400_000))
        await prisma.checkIn.upsert({
          where: { clientId_weekStart: { clientId: client.id, weekStart: ws } },
          create: { clientId: client.id, weekStart: ws, energy: 3 + (w % 2), nutritionAdherence: "70-90", sleep: "6-7", weight: p.now, feelings: "Buena semana, con más energía en los entrenos.", discomfort: w === 1 && p.firstName === "Andrea" ? "Molestia leve en la rodilla derecha en sentadilla" : null, createdAt: daysAgo(w * 7 - 6) },
          update: {},
        })
      }
    }

    // Pagos: meses anteriores pagados, el actual pendiente
    for (let m = 3; m >= 0; m--) {
      const d = new Date()
      d.setUTCMonth(d.getUTCMonth() - m, 1)
      const period = d.toISOString().slice(0, 7)
      await prisma.coachingPayment.create({
        data: { clientId: client.id, period, amount: 600, dueDate: new Date(`${period}-01T12:00:00Z`), status: m === 0 && p.firstName !== "Lucía" ? "PENDING" : "PAID", paidAt: m === 0 && p.firstName !== "Lucía" ? null : new Date(`${period}-02T12:00:00Z`), method: "YAPE" },
      })
    }

    await prisma.coachMessage.createMany({
      data: [
        { clientId: client.id, sender: "COACH", body: `¡Hola ${p.firstName}! ¿Cómo te sentiste hoy en el entrenamiento?`, createdAt: daysAgo(2), readAt: daysAgo(2) },
        { clientId: client.id, sender: "CLIENT", body: "Bien, pero el press inclinado me molestó un poco.", createdAt: daysAgo(1) },
      ],
    })
    console.log(`Demo: ${p.firstName} ${p.lastName} (${p.email} / fortia123)`)
  }

  // Horarios de la próxima semana
  const existingSlots = await prisma.coachingSlot.count({ where: { startsAt: { gte: new Date() } } })
  if (!existingSlots) {
    for (let d = 1; d <= 7; d++) {
      const date = ymd(daysAgo(-d))
      const wd = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7
      if (wd > 4) continue
      for (const t of ["07:00", "09:00", "10:00", "18:00"]) {
        const startsAt = new Date(`${date}T${t}:00-05:00`)
        await prisma.coachingSlot.create({ data: { startsAt, endsAt: new Date(startsAt.getTime() + 3600_000), capacity: t === "18:00" ? 4 : 1, title: t === "18:00" ? "Entrenamiento grupal" : "Sesión personal" } })
      }
    }
    console.log("Demo: horarios de la próxima semana creados")
  }

  if (!(await prisma.challenge.count())) {
    const start = `${today.slice(0, 8)}01`
    const [y, m] = today.split("-").map(Number)
    const end = `${today.slice(0, 8)}${new Date(Date.UTC(y, m, 0)).getUTCDate()}`
    await prisma.challenge.create({ data: { title: "30 días de consistencia", description: "Entrena y registra tu alimentación todos los días.", metric: "ACTIVE_DAYS", target: 24, startDate: start, endDate: end } })
  }
}

library()
  .then(() => (process.argv.includes("--demo") ? demo() : undefined))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
