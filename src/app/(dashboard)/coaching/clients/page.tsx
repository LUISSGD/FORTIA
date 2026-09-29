import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getClientsOverview } from "@/lib/coaching/stats"
import { formatYmd } from "@/lib/coaching/dates"
import { Panel, StatusDot } from "@/components/coaching/kit"
import AddCoachingClient from "./AddCoachingClient"

export const dynamic = "force-dynamic"

function pctTone(v: number | null) {
  if (v === null) return "text-gray-400"
  return v >= 80 ? "text-emerald-600" : v >= 60 ? "text-amber-600" : "text-red-600"
}

export default async function CoachingClientsPage() {
  const [overview, gymClients, ended, users] = await Promise.all([
    getClientsOverview(),
    prisma.client.findMany({
      where: { isActive: true, OR: [{ coachingProfile: null }, { coachingProfile: { status: "ENDED" } }] },
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.coachingProfile.findMany({ where: { status: "ENDED" }, include: { client: { select: { firstName: true, lastName: true } } } }),
    prisma.user.findMany({ where: { role: "CLIENT" }, select: { clientId: true } }),
  ])
  const withAccess = new Set(users.map((u) => u.clientId))

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Clientes de coaching</h1>
          <p className="text-sm text-gray-500">{overview.length} clientes · {overview.filter((c) => !withAccess.has(c.id)).length} sin acceso a la app</p>
        </div>
        <AddCoachingClient gymClients={gymClients} />
      </div>

      <Panel className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-3 py-2.5 font-medium">Objetivo</th>
                <th className="px-3 py-2.5 font-medium">Último entreno</th>
                <th className="px-3 py-2.5 font-medium">Semana</th>
                <th className="px-3 py-2.5 font-medium">Entreno 7d</th>
                <th className="px-3 py-2.5 font-medium">Nutrición 7d</th>
                <th className="px-3 py-2.5 font-medium">Check-in</th>
                <th className="px-3 py-2.5 font-medium">Peso</th>
                <th className="px-3 py-2.5 font-medium">Membresía</th>
                <th className="px-3 py-2.5 font-medium">Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {overview.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-gray-500 py-10">Aún no tienes clientes de coaching. Usa “Agregar cliente”.</td>
                </tr>
              )}
              {overview.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/coaching/clients/${c.id}`} className="flex items-center gap-2 font-medium text-gray-900 hover:text-orange-600">
                      <StatusDot level={c.status === "PAUSED" ? "gray" : c.level} />
                      {c.name}
                      {c.status === "PAUSED" && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 rounded">Pausado</span>}
                      {!withAccess.has(c.id) && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 rounded">Sin app</span>}
                      {c.unreadMessages > 0 && <span className="text-[10px] bg-orange-500 text-white px-1.5 rounded-full">{c.unreadMessages}</span>}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{c.goal ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">
                    {c.lastWorkout ? `${formatYmd(c.lastWorkout)} (${c.daysSinceWorkout === 0 ? "hoy" : `hace ${c.daysSinceWorkout} d`})` : "—"}
                  </td>
                  <td className="px-3 py-2.5">{c.workoutsThisWeek}/{c.trainingDays}</td>
                  <td className={`px-3 py-2.5 font-medium ${pctTone(c.trainingAdherence)}`}>{c.trainingAdherence === null ? "—" : `${c.trainingAdherence}%`}</td>
                  <td className={`px-3 py-2.5 font-medium ${pctTone(c.nutritionCompliance)}`}>{c.nutritionCompliance === null ? "—" : `${c.nutritionCompliance}%`}</td>
                  <td className="px-3 py-2.5">{c.checkInThisWeek ? "✅" : c.lastCheckIn ? formatYmd(c.lastCheckIn) : "—"}</td>
                  <td className="px-3 py-2.5">{c.lastWeight ? `${c.lastWeight} kg` : "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {c.membership.state === "none" ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span className={c.membership.state === "expired" || c.membership.state === "urgent" ? "text-red-600 font-medium" : c.membership.state === "warning" ? "text-amber-600" : "text-gray-600"} title={c.membership.planName ?? ""}>
                        {c.membership.state === "expired" ? "Vencida " : "Vence "}{formatYmd(c.membership.end!)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.pendingPayment ? (
                      <span className={c.pendingPayment.overdueDays > 0 ? "text-red-600 font-medium" : "text-amber-600"}>
                        {c.pendingPayment.overdueDays > 0 ? "Vencido" : "⏳ Pendiente"}
                      </span>
                    ) : (
                      <span className="text-emerald-600">🟢 Al día</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {ended.length > 0 && (
        <Panel title={`Finalizados (${ended.length})`}>
          <div className="flex flex-wrap gap-2">
            {ended.map((p) => (
              <Link key={p.id} href={`/coaching/clients/${p.clientId}`} className="text-xs bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1">
                {p.client.firstName} {p.client.lastName}
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </>
  )
}
