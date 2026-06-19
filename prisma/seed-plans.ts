import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import "dotenv/config"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const plans = [
    // FORTIA X
    { name: "FORTIA X — Mensual",     durationDays: 30,  price: 400,  description: "Build Your Best Physique · Acceso libre, rutina cada 6 semanas, consulta nutricional c/60 días" },
    { name: "FORTIA X — Trimestral",  durationDays: 90,  price: 960,  description: "Build Your Best Physique · Pack trimestral" },

    // PRIME ATHLETE
    { name: "PRIME ATHLETE — Mensual",    durationDays: 30,  price: 600,  description: "Experience the Fortia Method · Asesoramiento individualizado, planificación y nutrición personalizada" },
    { name: "PRIME ATHLETE — Trimestral", durationDays: 90,  price: 1530, description: "Experience the Fortia Method · Pack trimestral" },
    { name: "PRIME ATHLETE — Semestral",  durationDays: 180, price: 2880, description: "Experience the Fortia Method · Pack semestral" },

    // PRIME ATHLETE Corporativo
    { name: "PRIME ATHLETE Corporativo — Mensual",    durationDays: 30, price: 520,  description: "Tarifa corporativa Prime Athlete" },
    { name: "PRIME ATHLETE Corporativo — Trimestral", durationDays: 90, price: 1250, description: "Tarifa corporativa Prime Athlete · Pack trimestral" },

    // PRIME ATHLETE Atletas
    { name: "PRIME ATHLETE Atletas — Mensual",    durationDays: 30, price: 450,  description: "Atletas competitivos de alto nivel" },
    { name: "PRIME ATHLETE Atletas — Trimestral", durationDays: 90, price: 1080, description: "Atletas competitivos de alto nivel · Pack trimestral" },

    // ELITE ATHLETE — Head Coach Piero Roca
    { name: "ELITE ATHLETE Head Coach — 8 sesiones",  durationDays: 30, price: 920,  description: "Train 1-on-1 · Head Coach Piero Roca · 8 sesiones de 90 min" },
    { name: "ELITE ATHLETE Head Coach — 12 sesiones", durationDays: 45, price: 1200, description: "Train 1-on-1 · Head Coach Piero Roca · 12 sesiones de 90 min" },
    { name: "ELITE ATHLETE Head Coach — 16 sesiones", durationDays: 60, price: 1520, description: "Train 1-on-1 · Head Coach Piero Roca · 16 sesiones de 90 min" },

    // ELITE ATHLETE — Team Fortia
    { name: "ELITE ATHLETE Team Fortia — 8 sesiones",  durationDays: 30, price: 840,  description: "Train 1-on-1 · Team Fortia · 8 sesiones de 90 min" },
    { name: "ELITE ATHLETE Team Fortia — 12 sesiones", durationDays: 45, price: 1050, description: "Train 1-on-1 · Team Fortia · 12 sesiones de 90 min" },
    { name: "ELITE ATHLETE Team Fortia — 16 sesiones", durationDays: 60, price: 1350, description: "Train 1-on-1 · Team Fortia · 16 sesiones de 90 min" },

    // FORTIA SOCIO
    { name: "FORTIA SOCIO", durationDays: 30, price: 0, description: "Socios y patrocinados · Acceso gratuito" },
  ]

  for (const plan of plans) {
    await prisma.membershipPlan.upsert({
      where: { id: plan.name.toLowerCase().replace(/[^a-z0-9]/g, "-") },
      update: plan,
      create: { id: plan.name.toLowerCase().replace(/[^a-z0-9]/g, "-"), ...plan },
    })
    console.log(`✅ ${plan.name}`)
  }

  console.log("\n🎉 Planes agregados correctamente")
}

main().catch(console.error).finally(() => prisma.$disconnect())
