import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import bcrypt from "bcryptjs"
import { addDays, subDays } from "date-fns"
import "dotenv/config"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Clear existing data in dependency order
  await prisma.enrollment.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.income.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.scheduleSlot.deleteMany()
  await prisma.client.deleteMany()
  await prisma.class.deleteMany()
  await prisma.membershipPlan.deleteMany()
  await prisma.user.deleteMany()

  // Admin user
  const hashedPassword = await bcrypt.hash("fortia2025", 10)
  await prisma.user.create({
    data: { email: "admin@fortia.pe", password: hashedPassword, name: "Administrador FORTIA" },
  })

  // Membership plans
  const plans = await Promise.all([
    prisma.membershipPlan.create({ data: { id: "plan-mensual", name: "Mensual", durationDays: 30, price: 80, description: "Acceso completo por 30 días" } }),
    prisma.membershipPlan.create({ data: { id: "plan-bimestral", name: "Bimestral", durationDays: 60, price: 150, description: "Acceso completo por 60 días" } }),
    prisma.membershipPlan.create({ data: { id: "plan-trimestral", name: "Trimestral", durationDays: 90, price: 210, description: "Acceso completo por 90 días" } }),
    prisma.membershipPlan.create({ data: { id: "plan-anual", name: "Anual", durationDays: 365, price: 700, description: "Acceso completo por 365 días" } }),
  ])

  // Classes
  await Promise.all([
    prisma.class.create({ data: { id: "class-yoga", name: "Yoga", color: "#8b5cf6", maxCapacity: 15 } }),
    prisma.class.create({ data: { id: "class-spinning", name: "Spinning", color: "#f59e0b", maxCapacity: 20 } }),
    prisma.class.create({ data: { id: "class-crossfit", name: "CrossFit", color: "#ef4444", maxCapacity: 15 } }),
    prisma.class.create({ data: { id: "class-zumba", name: "Zumba", color: "#ec4899", maxCapacity: 25 } }),
    prisma.class.create({ data: { id: "class-pilates", name: "Pilates", color: "#06b6d4", maxCapacity: 12 } }),
    prisma.class.create({ data: { id: "class-funcional", name: "Funcional", color: "#10b981", maxCapacity: 18 } }),
  ])

  // Schedule slots
  const slots = await Promise.all([
    prisma.scheduleSlot.create({ data: { classId: "class-yoga", dayOfWeek: 0, startTime: "07:00", endTime: "08:00", instructor: "María López" } }),
    prisma.scheduleSlot.create({ data: { classId: "class-spinning", dayOfWeek: 0, startTime: "08:00", endTime: "09:00", instructor: "Carlos Ríos" } }),
    prisma.scheduleSlot.create({ data: { classId: "class-crossfit", dayOfWeek: 1, startTime: "06:00", endTime: "07:00", instructor: "Luis Fernández" } }),
    prisma.scheduleSlot.create({ data: { classId: "class-zumba", dayOfWeek: 2, startTime: "18:00", endTime: "19:00", instructor: "Ana Torres" } }),
    prisma.scheduleSlot.create({ data: { classId: "class-pilates", dayOfWeek: 3, startTime: "09:00", endTime: "10:00", instructor: "María López" } }),
    prisma.scheduleSlot.create({ data: { classId: "class-funcional", dayOfWeek: 4, startTime: "07:00", endTime: "08:00", instructor: "Luis Fernández" } }),
    prisma.scheduleSlot.create({ data: { classId: "class-spinning", dayOfWeek: 5, startTime: "08:00", endTime: "09:00", instructor: "Carlos Ríos" } }),
    prisma.scheduleSlot.create({ data: { classId: "class-yoga", dayOfWeek: 6, startTime: "09:00", endTime: "10:00", instructor: "María López" } }),
  ])

  // Demo clients
  const today = new Date()
  const clientsData = [
    { firstName: "Juan", lastName: "García", phone: "987654321", dni: "12345678", planId: "plan-mensual", daysOffset: 15 },
    { firstName: "María", lastName: "Rodríguez", phone: "987654322", dni: "12345679", planId: "plan-trimestral", daysOffset: 45 },
    { firstName: "Pedro", lastName: "Martínez", phone: "987654323", dni: "12345680", planId: "plan-mensual", daysOffset: 3 },
    { firstName: "Ana", lastName: "López", phone: "987654324", dni: "12345681", planId: "plan-bimestral", daysOffset: 30 },
    { firstName: "Carlos", lastName: "Sánchez", phone: "987654325", dni: "12345682", planId: "plan-anual", daysOffset: 200 },
    { firstName: "Lucía", lastName: "Pérez", phone: "987654326", dni: "12345683", planId: "plan-mensual", daysOffset: -2 },
    { firstName: "Miguel", lastName: "Torres", phone: "987654327", dni: "12345684", planId: "plan-trimestral", daysOffset: 60 },
    { firstName: "Sofía", lastName: "Díaz", phone: "987654328", dni: "12345685", planId: "plan-mensual", daysOffset: 7 },
    { firstName: "Jorge", lastName: "Ramírez", phone: "987654329", dni: "12345686", planId: "plan-bimestral", daysOffset: 20 },
    { firstName: "Valeria", lastName: "Castro", phone: "987654330", dni: "12345687", planId: "plan-mensual", daysOffset: 5 },
  ]

  const clients = await Promise.all(
    clientsData.map(async (c) => {
      const plan = plans.find((p) => p.id === c.planId)!
      const start = subDays(today, plan.durationDays - c.daysOffset)
      const end = addDays(start, plan.durationDays)
      return prisma.client.create({
        data: {
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          dni: c.dni,
          membershipPlanId: c.planId,
          membershipStart: start,
          membershipEnd: end,
        },
      })
    })
  )

  // Enrollments
  await Promise.all([
    prisma.enrollment.create({ data: { slotId: slots[0].id, clientId: clients[0].id } }),
    prisma.enrollment.create({ data: { slotId: slots[0].id, clientId: clients[1].id } }),
    prisma.enrollment.create({ data: { slotId: slots[1].id, clientId: clients[2].id } }),
    prisma.enrollment.create({ data: { slotId: slots[2].id, clientId: clients[3].id } }),
  ])

  // Sample income
  await prisma.income.createMany({
    data: [
      { amount: 80, category: "MEMBERSHIP", description: "Renovación membresía - Juan García", clientId: clients[0].id, date: subDays(today, 5) },
      { amount: 210, category: "MEMBERSHIP", description: "Renovación membresía - María Rodríguez", clientId: clients[1].id, date: subDays(today, 10) },
      { amount: 50, category: "PRODUCT_SALE", description: "Venta suplementos", date: subDays(today, 3) },
      { amount: 700, category: "MEMBERSHIP", description: "Membresía anual - Carlos Sánchez", clientId: clients[4].id, date: subDays(today, 15) },
      { amount: 30, category: "DAY_PASS", description: "Pases diarios", date: subDays(today, 1) },
    ],
  })

  // Sample expenses
  await prisma.expense.createMany({
    data: [
      { amount: 2500, category: "RENT", description: "Alquiler local - Junio", date: subDays(today, 12) },
      { amount: 380, category: "ELECTRICITY", description: "Recibo de luz", date: subDays(today, 8) },
      { amount: 90, category: "WATER", description: "Recibo de agua", date: subDays(today, 8) },
      { amount: 850, category: "SUPPLIER", description: "Pago proveedor equipos", vendor: "GymEquip SAC", date: subDays(today, 20) },
      { amount: 120, category: "INTERNET", description: "Internet mensual", date: subDays(today, 10) },
    ],
  })

  console.log("✅ Seed completado")
  console.log("📧 Email: admin@fortia.pe")
  console.log("🔑 Contraseña: fortia2025")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
