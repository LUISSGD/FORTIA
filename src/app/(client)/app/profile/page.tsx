import Link from "next/link"
import { redirect } from "next/navigation"
import { differenceInYears } from "date-fns"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import { LEVELS } from "@/lib/coaching/constants"
import { formatYmd, periodLabel, toYmd, todayYmd } from "@/lib/coaching/dates"
import { Card, SectionTitle } from "@/components/coaching/app/ui"
import { Suspense } from "react"
import ProfileActions from "@/components/coaching/app/ProfileActions"
import { PayOnlineButton, PaymentReturn } from "@/components/coaching/app/PayOnline"
import { mpEnabled } from "@/lib/coaching/mercadopago"

export default async function ProfilePage() {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const [client, payments] = await Promise.all([
    prisma.client.findUnique({ where: { id: ctx.clientId }, include: { coachingProfile: true, user: { select: { email: true } } } }),
    prisma.coachingPayment.findMany({ where: { clientId: ctx.clientId }, orderBy: { period: "desc" }, take: 6 }),
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

      <Card>
        <SectionTitle emoji="👤">Información</SectionTitle>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-gray-400">Objetivo</dt><dd>{p?.goal ?? "—"}</dd>
          <dt className="text-gray-400">Nivel</dt><dd>{LEVELS[p?.level ?? ""] ?? "—"}</dd>
          <dt className="text-gray-400">Edad</dt><dd>{client.birthDate ? `${differenceInYears(new Date(), client.birthDate)} años` : "—"}</dd>
          <dt className="text-gray-400">Altura</dt><dd>{p?.heightCm ? `${p.heightCm} cm` : "—"}</dd>
          <dt className="text-gray-400">Inicio</dt><dd>{p ? formatYmd(toYmd(p.startDate), true) : "—"}</dd>
          <dt className="text-gray-400">Entrenos/semana</dt><dd>{p?.trainingDays ?? "—"}</dd>
        </dl>
      </Card>

      <Card>
        <SectionTitle emoji="💳">Tu plan</SectionTitle>
        <p className="font-bold">{p?.planName ?? "Coaching"}</p>
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
