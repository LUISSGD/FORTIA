import { prisma } from "@/lib/prisma"
import UsersClient from "./UsersClient"

export const dynamic = "force-dynamic"

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  return <UsersClient users={users} />
}
