import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"
import { normalizeCalendarFields } from "@/lib/calendar"

// En despliegues de vista previa (Vercel Preview) se puede apuntar a una base demo con
// PREVIEW_DATABASE_URL sin tocar DATABASE_URL. En producción se ignora siempre.
function databaseUrl() {
  const preview = process.env.VERCEL_ENV !== "production" ? process.env.PREVIEW_DATABASE_URL : undefined
  return preview || process.env.DATABASE_URL!
}

const WRITE_OPS = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert"])

function createPrisma() {
  const adapter = new PrismaPg({ connectionString: databaseUrl() })
  // Toda fecha de calendario (clase, inicio de paquete, membresía, cumpleaños) se guarda
  // al mediodía UTC, venga de la pantalla que venga. Ver src/lib/calendar.ts.
  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          if (WRITE_OPS.has(operation) && args && typeof args === "object") {
            const a = args as { data?: unknown; create?: unknown; update?: unknown }
            normalizeCalendarFields(a.data)
            normalizeCalendarFields(a.create)
            normalizeCalendarFields(a.update)
          }
          return query(args)
        },
      },
    },
  })
}

type ExtendedPrisma = ReturnType<typeof createPrisma>
const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrisma }

export const prisma = globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

/** Cliente dentro de `prisma.$transaction(async (tx) => …)` (con la normalización de fechas incluida). */
export type Tx = Parameters<Extract<Parameters<typeof prisma.$transaction>[0], (...args: never[]) => unknown>>[0]
