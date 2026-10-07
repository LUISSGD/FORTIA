/**
 * Corrige las fechas de los pagos ya registrados (misma regla que src/lib/calendar.ts):
 *   - Pagos de clases EP y nutrición: el día del pago es la fecha del ingreso que se ingresó al registrarlo
 *     (antes se guardaba el momento del registro o la medianoche UTC, que en Lima es el día anterior).
 *   - Membresías y extensiones: el período se guarda al mediodía UTC del mismo día de calendario.
 *
 *   npx tsx --env-file=.env.local scripts/fix-payment-dates.ts           (reporte)
 *   npx tsx --env-file=.env.local scripts/fix-payment-dates.ts --apply   (escribe)
 */
import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { calendarDate, calendarYmd } from "../src/lib/calendar"

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
const APPLY = process.argv.includes("--apply")
const same = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null)

async function main() {
  const payments = await prisma.payment.findMany({
    select: {
      id: true, periodStart: true, periodEnd: true, prevMembershipStart: true, prevMembershipEnd: true, concept: true,
      income: { select: { date: true, category: true } },
      client: { select: { firstName: true, lastName: true } },
    },
  })
  let changed = 0
  for (const p of payments) {
    const oneDay = p.income && (p.income.category === "PERSONAL_TRAINING" || p.income.category === "NUTRITION")
    const start = oneDay ? calendarDate(p.income!.date) : calendarDate(p.periodStart)
    const end = oneDay ? start : calendarDate(p.periodEnd)
    const prevStart = p.prevMembershipStart ? calendarDate(p.prevMembershipStart) : null
    const prevEnd = p.prevMembershipEnd ? calendarDate(p.prevMembershipEnd) : null
    if (same(start, p.periodStart) && same(end, p.periodEnd) && same(prevStart, p.prevMembershipStart) && same(prevEnd, p.prevMembershipEnd)) continue
    changed++
    const was = `${calendarYmd(p.periodStart)} → ${calendarYmd(p.periodEnd)}`
    const now = `${calendarYmd(start)} → ${calendarYmd(end)}`
    if (was !== now) console.log(`${p.client.firstName.trim()} ${p.client.lastName.trim()} · ${p.concept?.slice(0, 40) ?? ""}: ${was}  ⇒  ${now}`)
    if (APPLY) {
      await prisma.payment.update({ where: { id: p.id }, data: { periodStart: start, periodEnd: end, prevMembershipStart: prevStart, prevMembershipEnd: prevEnd } })
    }
  }
  console.log(`\n${changed} de ${payments.length} pagos ${APPLY ? "corregidos" : "a corregir (los que no aparecen arriba solo cambian la hora interna)"}`)
}

main().finally(() => prisma.$disconnect())
