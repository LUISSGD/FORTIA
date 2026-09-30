import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getClientsOverview } from "@/lib/coaching/stats"
import { Panel } from "@/components/coaching/kit"
import AddCoachingClient from "./AddCoachingClient"
import ClientsTable from "./ClientsTable"

export const dynamic = "force-dynamic"

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
  const missing = gymClients.length - ended.filter((p) => gymClients.some((g) => g.id === p.clientId)).length

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Clientes de coaching</h1>
          <p className="text-sm text-gray-500">
            {overview.filter((c) => c.status !== "STANDBY").length} activos · {overview.filter((c) => c.status === "STANDBY").length} en stand-by · {overview.filter((c) => c.status !== "STANDBY" && !withAccess.has(c.id)).length} sin acceso a la app
          </p>
        </div>
        <AddCoachingClient gymClients={gymClients} />
      </div>

      {missing > 0 && (
        <Link href="/coaching/import" className="block rounded-xl bg-sky-50 border border-sky-200 text-sky-800 px-4 py-3 text-sm hover:bg-sky-100">
          ℹ️ {missing} cliente(s) activos de FORTIA aún no están en Coaching. <span className="font-semibold underline">Revisarlos y traerlos →</span>
        </Link>
      )}

      <ClientsTable rows={overview.map((c) => ({ ...c, hasApp: withAccess.has(c.id) }))} />

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
