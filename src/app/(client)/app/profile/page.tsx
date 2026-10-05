import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import { formatYmd, periodLabel, toYmd, todayYmd } from "@/lib/coaching/dates"
import { Card, SectionTitle } from "@/components/coaching/app/ui"
import { Suspense } from "react"
import ProfileActions from "@/components/coaching/app/ProfileActions"
import ProfileInfo from "@/components/coaching/app/ProfileInfo"
import { getLatestWeight } from "@/lib/coaching/client-data"
import { PayOnlineButton, PaymentReturn } from "@/components/coaching/app/PayOnline"
import { mpEnabled } from "@/lib/coaching/mercadopago"

export default async function ProfilePage({ searchParams }: PageProps<"/app/profile">) {
  const sp = await searchParams
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const [client, payments, weight] = await Promise.all([
    prisma.client.findUnique({ where: { id: ctx.clientId }, include: { coachingProfile: true, user: { select: { email: true } } } }),
    prisma.coachingPayment.findMany({ where: { clientId: ctx.clientId }, orderBy: { period: "desc" }, take: 6 }),
    getLatestWeight(ctx.clientId),
  ])
  if (!client) redirect("/login")
  const p = client.coachingProfile
  const pending = payments.find((x) => x.status === "PENDING")
  const today = todayYmd()

  return (
    <div className="space-y-4">
      <Suspense><PaymentReturn /></Suspense>
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

      <Card>
        <SectionTitle emoji="💳">Tu plan</SectionTitle>
        {p?.price ? <p className="text-sm text-gray-400">{p.currency === "USD" ? "$" : "S/"}{p.price} / mes</p> : null}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 p-3">
          <span className="text-sm">Estado</span>
          {pending ? (
            <span className={toYmd(pending.dueDate) < today ? "text-red-500 font-bold text-sm" : "text-amber-600 font-bold text-sm"}>
              {toYmd(pending.dueDate) < today ? "🔴 VENCIDO" : "⏳ PENDIENTE"}
            </span>
          ) : payments.length ? <span className="text-emerald-600 font-bold text-sm">🟢 PAGADO</span> : <span className="text-gray-400 text-sm">—</span>}
        </div>
        {pending && <p className="text-xs text-gray-400 mt-2">Próximo pago: {formatYmd(toYmd(pending.dueDate), true)} · {pending.currency === "USD" ? "$" : "S/"}{pending.amount}</p>}
        {pending && mpEnabled() && <PayOnlineButton paymentId={pending.id} label={`Pagar ${pending.currency === "USD" ? "$" : "S/"}${pending.amount} con Mercado Pago`} />}
        {payments.length > 0 && (
          <table className="w-full text-sm mt-3">
            <tbody className="divide-y divide-gray-100">
              {payments.map((x) => (
                <tr key={x.id}>
                  <td className="py-1.5">{periodLabel(x.period)}</td>
                  <td className="py-1.5 text-right">{x.status === "PAID" ? "✅" : "⏳"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

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
