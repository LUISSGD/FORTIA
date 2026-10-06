/**
 * Separa las parejas activas: la 2ª persona pasa a tener su propia ficha (app, rutina, chat, check-ins)
 * enlazada a la ficha principal con `partnerOfId`. La membresía, el plan EP y los pagos siguen en la
 * ficha principal y se comparten.
 *
 * Ejecutar:
 *   npx tsx --env-file=.env.local scripts/split-couples.ts           (reporte, no escribe)
 *   npx tsx --env-file=.env.local scripts/split-couples.ts --apply   (escribe)
 *
 * Por pareja:
 *   - crea la ficha de la 2ª persona (nombre2, apellido2, teléfono2, DNI2) y su perfil de coaching;
 *   - si la rutina activa mezcla los días de los dos (p. ej. "Fullbody A (Aurora)" o "ETTO A — Pablo"),
 *     mueve los días de la 2ª persona a una rutina propia y quita el nombre de los días;
 *   - los entrenamientos ya registrados en esos días pasan a la 2ª persona.
 * Las fichas con los dos nombres en el nombre ("JULIO Y AURORA") se separan usando el login existente
 * para saber quién es la principal. Se puede repetir: salta las parejas ya separadas.
 */

import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
const APPLY = process.argv.includes("--apply")

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
const cap = (s: string) => s.trim().toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase())
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** ¿El nombre del día es de esta persona? ("… — Pablo", "(Aurora)", "(Francis)") */
function dayOwner(dayName: string, names: string[]) {
  const n = norm(dayName)
  return names.some((x) => x.length >= 3 && new RegExp(`(—|-|\\()\\s*${escapeRe(norm(x))}`).test(n))
}
/** Quita el nombre de la persona del nombre del día. */
function stripName(dayName: string, names: string[]) {
  let s = dayName
  for (const x of names) {
    s = s.replace(new RegExp(`\\s*—\\s*${escapeRe(x)}\\s*$`, "i"), "").replace(new RegExp(`\\s*\\(${escapeRe(x)}\\)`, "i"), "")
  }
  return s.trim()
}

async function main() {
  const candidates = await prisma.client.findMany({
    where: {
      isActive: true,
      partnerOfId: null,
      partner: null,
      OR: [{ firstName2: { not: null } }, { firstName: { contains: " y ", mode: "insensitive" } }],
    },
    include: {
      coachingProfile: true,
      user: { select: { email: true } },
      programs: { where: { isActive: true, isTemplate: false }, include: { days: true } },
    },
  })

  for (const c of candidates) {
    // Nombres de cada persona
    let first1 = c.firstName.trim()
    let first2 = (c.firstName2 ?? "").trim()
    let last2 = (c.lastName2 ?? "").trim()
    let renamePrimary: { firstName: string; firstName2: string } | null = null
    if (!first2) {
      const m = c.firstName.match(/^\s*(.+?)\s+y\s+(.+?)\s*$/i)
      if (!m) continue
      let [a, b] = [cap(m[1]), cap(m[2])]
      // El login existente se queda con su dueño (p. ej. aurora@… → Aurora es la principal)
      const login = norm(c.user?.email ?? "")
      if (login && login.startsWith(norm(b))) [a, b] = [b, a]
      first1 = a
      first2 = b
      last2 = c.lastName.trim()
      renamePrimary = { firstName: a, firstName2: b }
    }
    if (!last2) last2 = "."

    const names1 = [first1, first1.split(/\s+/)[0], first1.split(/\s+/)[0].slice(0, 7)]
    const names2 = [first2, first2.split(/\s+/)[0], first2.split(/\s+/)[0].slice(0, 7)]
    const program = c.programs[0]
    const days2 = program ? program.days.filter((d) => dayOwner(d.name, names2) && !dayOwner(d.name, names1)) : []
    const days1 = program ? program.days.filter((d) => !days2.includes(d)) : []

    console.log(`\n■ ${c.firstName.trim()} ${c.lastName.trim()} → ${first1} | ${first2} ${last2}`)
    if (program) {
      console.log(`  rutina "${program.name}": ${days1.length} días para ${first1}, ${days2.length} para ${first2}`)
      for (const d of days2) console.log(`    → ${first2}: ${stripName(d.name, names2)}`)
    } else console.log("  sin rutina activa")

    if (!APPLY) continue
    await prisma.$transaction(async (tx) => {
      if (renamePrimary) await tx.client.update({ where: { id: c.id }, data: renamePrimary })
      const partner = await tx.client.create({
        data: {
          firstName: first2,
          lastName: last2,
          phone: c.phone2,
          dni: c.dni2 && !(await tx.client.findFirst({ where: { dni: c.dni2 } })) ? c.dni2 : null,
          trainer: c.trainer,
          partnerOfId: c.id,
          notes: `Pareja de ${first1} ${c.lastName.trim()}: membresía, clases EP y pagos compartidos en su ficha.`,
        },
      })
      if (c.coachingProfile) {
        const p = c.coachingProfile
        await tx.coachingProfile.create({
          data: { clientId: partner.id, status: p.status, goal: p.goal, level: p.level, trainingDays: p.trainingDays, startDate: p.startDate, planName: p.planName, price: null },
        })
      }
      if (program && days2.length) {
        const own = (who: string) => program.name.replace(/[\p{L}.]+\s*(&|\by\b)\s*[\p{L}.]+/iu, who)
        const p2 = await tx.program.create({
          data: { name: own(first2), goal: program.goal, level: program.level, description: program.description, weeks: program.weeks, isTemplate: false, isActive: true, startDate: program.startDate, clientId: partner.id },
        })
        await tx.program.update({ where: { id: program.id }, data: { name: own(first1) } })
        for (const d of days2) {
          await tx.programDay.update({ where: { id: d.id }, data: { programId: p2.id, name: stripName(d.name, names2) } })
          await tx.workoutLog.updateMany({ where: { programDayId: d.id, clientId: c.id }, data: { clientId: partner.id } })
        }
        for (const d of days1) {
          const name = stripName(d.name, names1)
          if (name !== d.name) await tx.programDay.update({ where: { id: d.id }, data: { name } })
        }
      }
      console.log(`  ✅ ficha creada: ${partner.id}`)
    })
  }
  if (!APPLY) console.log("\n(Reporte. Para aplicar: --apply)")
}

main().finally(() => prisma.$disconnect())
