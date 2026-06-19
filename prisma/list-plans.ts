import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import "dotenv/config"
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })
async function main() {
  const plans = await prisma.membershipPlan.findMany({ select: { id: true, name: true } })
  plans.forEach(p => console.log(`${p.id} | ${p.name}`))
}
main().finally(() => prisma.$disconnect())
