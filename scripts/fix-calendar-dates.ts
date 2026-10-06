/**
 * Repara las fechas de calendario guardadas antes de la regla única (src/lib/calendar.ts):
 * las lleva al mediodía UTC del día correcto para que se vean igual en todas las pantallas.
 *
 *   npx tsx --env-file=.env scripts/fix-calendar-dates.ts           (simulación)
 *   npx tsx --env-file=.env scripts/fix-calendar-dates.ts --apply   (escribe)
 *
 * Idempotente: lo que ya está al mediodía UTC no se toca.
 */
import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { calendarDate } from "../src/lib/calendar"

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
const APPLY = process.argv.includes("--apply")
const isNoon = (d: Date) => d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
const day = (d: Date) => d.toISOString().slice(0, 10)

async function main() {
  console.log(APPLY ? "APLICANDO" : "SIMULACIÓN (usa --apply)")
  let changes = 0

  const clients = await prisma.client.findMany({ select: { id: true, firstName: true, lastName: true, birthDate: true, membershipStart: true, membershipEnd: true } })
  for (const c of clients) {
    const data: Record<string, Date> = {}
    for (const k of ["birthDate", "membershipStart", "membershipEnd"] as const) {
      const v = c[k]
      if (v && !isNoon(v)) data[k] = calendarDate(v)
    }
    if (Object.keys(data).length) {
      changes++
      if (!APPLY && changes <= 15) console.log(`  Cliente ${c.firstName} ${c.lastName}: ${Object.entries(data).map(([k, v]) => `${k} ${c[k as "birthDate"]!.toISOString()} → ${day(v)}`).join(" · ")}`)
      if (APPLY) await prisma.client.update({ where: { id: c.id }, data })
    }
  }

  const nutri = await prisma.nutritionClient.findMany({ where: { birthDate: { not: null } }, select: { id: true, birthDate: true } })
  for (const n of nutri) if (n.birthDate && !isNoon(n.birthDate)) {
    changes++
    if (APPLY) await prisma.nutritionClient.update({ where: { id: n.id }, data: { birthDate: calendarDate(n.birthDate) } })
  }

  const plans = await prisma.clientTrainingPlan.findMany({ where: { currentPackStart: { not: null } }, select: { id: true, currentPackStart: true, client: { select: { firstName: true } } } })
  for (const p of plans) if (p.currentPackStart && !isNoon(p.currentPackStart)) {
    changes++
    if (!APPLY) console.log(`  Paquete de ${p.client.firstName}: inicio ${p.currentPackStart.toISOString()} → ${day(calendarDate(p.currentPackStart))}`)
    if (APPLY) await prisma.clientTrainingPlan.update({ where: { id: p.id }, data: { currentPackStart: calendarDate(p.currentPackStart) } })
  }

  const sessions = await prisma.trainingSession.findMany({ where: { scheduledDate: { not: null } }, select: { id: true, sessionNumber: true, scheduledDate: true, plan: { select: { client: { select: { firstName: true } } } } } })
  for (const s of sessions) if (s.scheduledDate && !isNoon(s.scheduledDate)) {
    changes++
    if (!APPLY) console.log(`  Clase S${s.sessionNumber} de ${s.plan.client.firstName}: ${s.scheduledDate.toISOString()} → ${day(calendarDate(s.scheduledDate))}`)
    if (APPLY) await prisma.trainingSession.update({ where: { id: s.id }, data: { scheduledDate: calendarDate(s.scheduledDate) } })
  }

  console.log(`\n${changes} registros ${APPLY ? "corregidos" : "por corregir"}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
