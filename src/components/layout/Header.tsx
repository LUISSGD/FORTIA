import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Bell } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

async function getExpiringCount() {
  const now = new Date()
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return prisma.client.count({
    where: { isActive: true, membershipEnd: { gte: now, lte: sevenDays } },
  })
}

export default async function Header({ title }: { title?: string }) {
  const session = await auth()
  const expiringCount = await getExpiringCount()
  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("") ?? "A"

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-gray-900">{title ?? "FORTIA"}</h1>
      <div className="flex items-center gap-4">
        {expiringCount > 0 && (
          <div className="relative">
            <Bell className="h-5 w-5 text-gray-500" />
            <Badge className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-orange-500">
              {expiringCount}
            </Badge>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-orange-500 text-white text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-gray-700">{session?.user?.name}</span>
        </div>
      </div>
    </header>
  )
}
