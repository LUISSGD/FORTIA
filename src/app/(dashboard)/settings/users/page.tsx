import { prisma } from "@/lib/prisma"
import UsersClient from "./UsersClient"

export const dynamic = "force-dynamic"

export default async function UsersPage() {
  // Los accesos de clientes a la app se gestionan en Coaching; aquí solo el staff.
  const users = await prisma.user.findMany({
    where: { role: { not: "CLIENT" } },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  return <UsersClient users={users} />
}
