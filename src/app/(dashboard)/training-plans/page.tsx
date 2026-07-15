export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import Header from "@/components/layout/Header"
import Link from "next/link"
import { ENTRENADOR_LABELS, MODALIDAD_LABELS } from "@/lib/training-pricing"
import type { Entrenador, Modalidad } from "@/lib/training-pricing"

function packLabel(current: number, total: number) {
  return `Pack ${current} / ${total}`
}

export default async function TrainingPlansPage() {
  const plans = await prisma.clientTrainingPlan.findMany({
    where: { status: { in: ["ACTIVE", "PAUSED"] } },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      sessions: { orderBy: { sessionNumber: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  })

  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    PAUSED: "bg-yellow-100 text-yellow-700",
  }

  return (
    <>
      <Header title="Entrenamiento Personalizado" />
      <main className="flex-1 p-3 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">{plans.length} planes activos</p>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                  <th className="text-left px-3 py-3 font-medium text-gray-600">Plan</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">Pack</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">Clases del pack</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {plans.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">Sin planes activos</td></tr>
                ) : plans.map(plan => {
                  const totalClases = plan.numPacks * plan.clasesPerPack
                  const currentPack = Math.min(Math.floor(plan.sessionsCompleted / plan.clasesPerPack) + 1, plan.numPacks)
                  const sessionsInPack = plan.sessionsCompleted % plan.clasesPerPack
                  const progressPct = (sessionsInPack / plan.clasesPerPack) * 100

                  return (
                    <tr key={plan.id} className="hover:bg-orange-50/30">
                      <td className="px-4 py-3">
                        <Link href={`/clients/${plan.client.id}`} className="font-medium text-orange-600 hover:underline">
                          {plan.client.firstName} {plan.client.lastName}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{MODALIDAD_LABELS[plan.modalidad as Modalidad] ?? plan.modalidad}</p>
                        <p className="text-xs text-gray-400">{ENTRENADOR_LABELS[plan.tipoEntrenador as Entrenador] ?? plan.tipoEntrenador} · {plan.tarifa}</p>
                      </td>
                      <td className="px-3 py-3 text-center text-xs font-medium">
                        {packLabel(currentPack, plan.numPacks)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${progressPct}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 whitespace-nowrap">{sessionsInPack}/{plan.clasesPerPack}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-gray-500">{plan.sessionsCompleted}/{totalClases}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[plan.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {plan.status === "ACTIVE" ? "Activo" : "Pausado"}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  )
}
