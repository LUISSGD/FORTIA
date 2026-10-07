/**
 * "Fecha del pago" (Payment.paidAt) = día en que el ingreso cuenta en Finanzas (Income.date).
 * Antes paidAt era el momento del registro. Solo toca pagos con ingreso vinculado.
 *   npx tsx --env-file=.env.local scripts/fix-payment-paidat.ts [--apply]
 */
import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { calendarDate, calendarYmd } from "../src/lib/calendar"

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
const APPLY = process.argv.includes("--apply")

async function main() {
  const payments = await prisma.payment.findMany({ where: { incomeId: { not: null } }, select: { id: true, paidAt: true, concept: true, income: { select: { date: true } }, client: { select: { firstName: true } } } })
  let n = 0
  for (const p of payments) {
    const day = calendarDate(p.income!.date)
    if (day.getTime() === p.paidAt.getTime()) continue
    n++
    if (calendarYmd(day) !== calendarYmd(p.paidAt)) console.log(`${p.client.firstName.trim()} · ${p.concept?.slice(0, 40)}: ${calendarYmd(p.paidAt)} ⇒ ${calendarYmd(day)}`)
    if (APPLY) await prisma.payment.update({ where: { id: p.id }, data: { paidAt: day } })
  }
  console.log(`\n${n} de ${payments.length} pagos ${APPLY ? "actualizados" : "a actualizar"}`)
}
main().finally(() => prisma.$disconnect())
