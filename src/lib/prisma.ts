import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// En despliegues de vista previa (Vercel Preview) se puede apuntar a una base demo con
// PREVIEW_DATABASE_URL sin tocar DATABASE_URL. En producción se ignora siempre.
function databaseUrl() {
  const preview = process.env.VERCEL_ENV !== "production" ? process.env.PREVIEW_DATABASE_URL : undefined
  return preview || process.env.DATABASE_URL!
}

function createPrisma() {
  const adapter = new PrismaPg({ connectionString: databaseUrl() })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma || createPrisma()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
