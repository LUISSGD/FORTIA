/**
 * Tarifario oct. 2026 en los planes de membresía (Finanzas → Planes).
 *   npx tsx --env-file=.env.local scripts/pricing-oct-2026.ts [--apply]
 * - Los planes "Head Coach (Regular)" actuales pasan a llamarse "(Regular, tarifa anterior)": los clientes
 *   que ya los tienen conservan su precio.
 * - Se crean los planes nuevos: Head Coach (precios nuevos), Julio y los de 3 packs (90 días).
 */
import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
const APPLY = process.argv.includes("--apply")

type Row = [entrenador: string, modalidad: "Elite Athlete" | "Elite Athlete Parejas", packs: 1 | 3, prices: [number, number, number], tarifa?: string]
const ROWS: Row[] = [
  ["Head Coach", "Elite Athlete", 1, [1280, 1800, 2240], "Regular"],
  ["Head Coach", "Elite Athlete", 3, [3360, 4860, 6000], "Regular"],
  ["Head Coach", "Elite Athlete Parejas", 1, [1680, 2340, 2920], "Regular"],
  ["Head Coach", "Elite Athlete Parejas", 3, [4560, 6300, 7920], "Regular"],
  ["Julio", "Elite Athlete", 1, [920, 1200, 1520]],
  ["Julio", "Elite Athlete", 3, [2580, 3400, 4320]],
  ["Julio", "Elite Athlete Parejas", 1, [1200, 1440, 1760]],
  ["Julio", "Elite Athlete Parejas", 3, [3300, 4000, 4920]],
  ["Team Fortia", "Elite Athlete", 3, [2250, 2780, 3700]],
  ["Team Fortia", "Elite Athlete Parejas", 3, [3000, 3500, 4250]],
]
const SESSIONS = [8, 12, 16] as const

async function main() {
  // Ya aplicado: no volver a renombrar (los planes nuevos también terminan en "(Regular)")
  if (await prisma.membershipPlan.count({ where: { name: { contains: "tarifa anterior" } } })) {
    console.log("El tarifario oct. 2026 ya está aplicado.")
    return
  }
  // 1. Planes Head Coach (Regular) actuales → tarifa anterior
  const old = await prisma.membershipPlan.findMany({ where: { isActive: true, name: { contains: "— Head Coach —" }, AND: [{ name: { endsWith: "(Regular)" } }] }, select: { id: true, name: true, price: true } })
  for (const p of old) {
    const name = p.name.replace(/\(Regular\)$/, "(Regular, tarifa anterior)")
    console.log(`renombrar: ${p.name} (S/ ${p.price}) → ${name}`)
    if (APPLY) await prisma.membershipPlan.update({ where: { id: p.id }, data: { name } })
  }
  // 2. Planes nuevos
  for (const [coach, mod, packs, prices, tarifa] of ROWS) {
    for (let i = 0; i < 3; i++) {
      const n = SESSIONS[i]
      const ses = mod === "Elite Athlete" ? `${n} sesiones` : `${n} ses.`
      const name = `${mod} — ${coach} — ${ses}${packs === 3 ? " × 3 packs" : ""}${tarifa ? ` (${tarifa})` : ""}`
      const exists = await prisma.membershipPlan.findFirst({ where: { name } })
      if (exists && !old.some((o) => o.id === exists.id)) { console.log(`ya existe: ${name}`); continue }
      const durationDays = packs === 3 ? 90 : 28
      const description = `${coach} · ${mod}${tarifa ? ` · ${tarifa}` : ""} · ${packs === 3 ? `${n * 3} clases / 3 meses` : `${n} clases / 4 sem.`}`
      console.log(`crear: ${name} | S/ ${prices[i]} | ${durationDays} días`)
      if (APPLY) await prisma.membershipPlan.create({ data: { name, price: prices[i], durationDays, description, isActive: true } })
    }
  }
  if (!APPLY) console.log("\n(Reporte. Para aplicar: --apply)")
}
main().finally(() => prisma.$disconnect())
