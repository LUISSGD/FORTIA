import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import "dotenv/config"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const ids = ["plan-mensual", "plan-bimestral", "plan-trimestral", "plan-anual"]
  for (const id of ids) {
    const deleted = await prisma.membershipPlan.deleteMany({ where: { id } })
    if (deleted.count > 0) console.log(`🗑 Eliminado: ${id}`)
    else console.log(`⚠ No encontrado: ${id}`)
  }
  console.log("✅ Listo")
}

main().catch(console.error).finally(() => prisma.$disconnect())
