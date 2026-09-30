import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import TopNavClient from "./TopNavClient"

async function getExpiringCount() {
  const now = new Date()
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return prisma.client.count({
    where: { isActive: true, membershipEnd: { gte: now, lte: sevenDays } },
  })
}

export default async function TopNav() {
  const session = await auth()
  const expiringCount = await getExpiringCount().catch(() => 0)
  const initials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("") ?? "A"

  return (
    <TopNavClient
      expiringCount={expiringCount}
      initials={initials}
      name={session?.user?.name ?? null}
    />
  )
}
