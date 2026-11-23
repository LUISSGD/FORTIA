import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { parseModules } from "@/lib/staff-access"
import UsersClient from "./UsersClient"

export const dynamic = "force-dynamic"

export default async function UsersPage() {
  if ((await auth())?.user?.role !== "ADMIN") redirect("/")
  // Los accesos de clientes a la app se gestionan en Coaching; aquí solo el staff.
  const users = await prisma.user.findMany({
    where: { role: { not: "CLIENT" } },
    select: { id: true, name: true, email: true, role: true, createdAt: true, staffAccess: { select: { modules: true } } },
    orderBy: { createdAt: "asc" },
  })

  return <UsersClient users={users.map(({ staffAccess, ...u }) => ({ ...u, modules: u.role === "USER" ? parseModules(staffAccess?.modules) : null }))} />
}
