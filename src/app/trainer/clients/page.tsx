import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function TrainerClientsPage() {
  const plans = await prisma.clientTrainingPlan.findMany({
    where: { status: { in: ["ACTIVE", "PAUSED"] } },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      sessions: {
        where: { scheduledDate: { gte: new Date() }, attended: null },
        orderBy: { scheduledDate: "asc" },
        take: 1,
      },
    },
    orderBy: { currentPackStart: "desc" },
  })

  return (
    <div className="p-4 max-w-lg mx-auto space-y-3">
      <h1 className="text-base font-semibold text-gray-900">Clientes EP</h1>
      {plans.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No hay planes activos.</p>
      )}
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
        {plans.map((plan) => {
          const total = plan.numPacks * plan.clasesPerPack
          const next = plan.sessions[0]
          const nextDate = next?.scheduledDate ? next.scheduledDate.toISOString().slice(0, 10) : null
          return (
            <li key={plan.id}>
              <Link
                href={`/trainer/clients/${plan.client.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">
                    {plan.client.firstName} {plan.client.lastName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {plan.sessionsCompleted}/{total} clases
                    {nextDate && ` · próxima ${nextDate.split("-").reverse().join("/")}`}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${plan.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                  {plan.status === "ACTIVE" ? "Activo" : "Pausado"}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
