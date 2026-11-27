import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import { formatYmd, toYmd } from "@/lib/coaching/dates"
import { Card } from "@/components/coaching/app/ui"
import ProfileActions from "@/components/coaching/app/ProfileActions"
import ProfileInfo from "@/components/coaching/app/ProfileInfo"
import { getLatestWeight } from "@/lib/coaching/client-data"

export default async function ProfilePage({ searchParams }: PageProps<"/app/profile">) {
  const sp = await searchParams
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const [client, weight] = await Promise.all([
    prisma.client.findUnique({ where: { id: ctx.clientId }, include: { coachingProfile: true, user: { select: { email: true } } } }),
    getLatestWeight(ctx.clientId),
  ])
  if (!client) redirect("/login")
  const p = client.coachingProfile

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-orange-500 flex items-center justify-center text-xl font-black">{client.firstName[0]}{client.lastName[0]}</div>
        <div>
          <h1 className="text-2xl font-black">{client.firstName} {client.lastName}</h1>
          <p className="text-sm text-gray-400">{client.user?.email}</p>
        </div>
      </div>

      <ProfileInfo
        openOnLoad={sp.editar === "1"}
        startDate={p ? formatYmd(toYmd(p.startDate), true) : null}
        initial={{
          phone: client.phone ?? "",
          birthDate: client.birthDate ? client.birthDate.toISOString().slice(0, 10) : "",
          sex: p?.sex ?? "",
          heightCm: p?.heightCm ? String(p.heightCm) : "",
          currentWeight: weight.current !== null ? String(weight.current) : "",
          targetWeight: p?.targetWeight ? String(p.targetWeight) : "",
          goal: p?.goal ?? "",
          level: p?.level ?? "",
          trainingDays: String(p?.trainingDays ?? 4),
          injuries: p?.injuries ?? "",
        }}
      />

      <div className="grid grid-cols-2 gap-3">
        {[
          ["/app/personal", "🎟️", "Mi plan y clases"],
          ["/app/checkin", "📝", "Check-in"],
          ["/app/bookings", "📅", "Reservas"],
          ["/app/documents", "📄", "Documentos"],
          ["/app/challenge", "🏆", "Retos"],
          ["/app/notifications", "🔔", "Notificaciones"],
          ["/app/chat", "💬", "Chat"],
        ].map(([href, emoji, label]) => (
          <Card key={href} href={href} className="py-4 text-center">
            <p className="text-2xl">{emoji}</p>
            <p className="text-sm font-semibold mt-1">{label}</p>
          </Card>
        ))}
      </div>

      <ProfileActions />
      <p className="text-center text-[11px] text-gray-400">FORTIA Coaching · <Link href="/app">Inicio</Link></p>
    </div>
  )
}
