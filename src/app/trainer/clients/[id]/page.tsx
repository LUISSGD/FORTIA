import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import TrainerClientSessions from "./TrainerClientSessions"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export default async function TrainerClientPage({ params }: Ctx) {
  const { id } = await params

  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      birthDate: true,
      trainingPlans: {
        where: { status: { in: ["ACTIVE", "PAUSED"] } },
        include: {
          sessions: { orderBy: [{ isRescheduled: "asc" }, { sessionNumber: "asc" }] },
          scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
        },
        orderBy: { currentPackStart: "desc" },
        take: 1,
      },
    },
  })

  if (!client) notFound()

  const plan = client.trainingPlans[0] ?? null
  const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/trainer/clients" className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-base font-semibold text-gray-900">
            {client.firstName.trim()} {client.lastName.trim()}
          </h1>
          {client.phone && <p className="text-xs text-gray-400">{client.phone}</p>}
        </div>
      </div>

      {!plan ? (
        <p className="text-sm text-gray-400 text-center py-8">Sin plan activo.</p>
      ) : (
        <>
          {/* Info del plan */}
          <div className="rounded-xl border border-gray-100 p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Plan actual</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Clases</span>
              <span className="font-medium">{plan.sessionsCompleted} / {plan.numPacks * plan.clasesPerPack}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-orange-400 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, (plan.sessionsCompleted / (plan.numPacks * plan.clasesPerPack)) * 100)}%` }}
              />
            </div>
            {plan.scheduleSlots.length > 0 && (
              <p className="text-xs text-gray-400">
                Horario: {plan.scheduleSlots.map((s) => `${DAYS[s.dayOfWeek]} ${s.startTime.slice(0, 5)}`).join(", ")}
              </p>
            )}
          </div>

          {/* Lista de sesiones interactiva */}
          <TrainerClientSessions
            clientId={client.id}
            planId={plan.id}
            sessions={plan.sessions.map((s) => ({
              sessionId: s.id,
              sessionNumber: s.sessionNumber,
              scheduledDate: s.scheduledDate ? s.scheduledDate.toISOString().slice(0, 10) : null,
              attended: s.attended,
              isRescheduled: s.isRescheduled,
            }))}
          />
        </>
      )}
    </div>
  )
}
