import { prisma } from "@/lib/prisma"
import Header from "@/components/layout/Header"
import WeeklyGrid from "@/components/schedule/WeeklyGrid"
import type { Slot } from "@/components/schedule/WeeklyGrid"
import CreateSlotDialog from "@/components/schedule/CreateSlotDialog"
import { ENTRENADOR_LABELS } from "@/lib/training-pricing"
import type { Entrenador } from "@/lib/training-pricing"

export const dynamic = "force-dynamic"

export default async function SchedulePage() {
  const [slots, classes, ptSlots] = await Promise.all([
    prisma.scheduleSlot.findMany({
      where: { isActive: true },
      include: {
        class: true,
        enrollments: {
          include: { client: { select: { id: true, firstName: true, lastName: true, phone: true } } },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.class.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.personalTrainingSlot.findMany({
      include: {
        plan: {
          include: {
            client: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
  ])

  const transformedPtSlots = ptSlots.map(pts => ({
    id: pts.id,
    dayOfWeek: pts.dayOfWeek,
    startTime: pts.startTime,
    endTime: pts.endTime,
    instructor: ENTRENADOR_LABELS[pts.plan.tipoEntrenador as Entrenador] ?? pts.plan.tipoEntrenador,
    isPT: true as const,
    planId: pts.planId,
    clientId: pts.plan.clientId,
    class: {
      name: `PT: ${pts.plan.client.firstName} ${pts.plan.client.lastName}`,
      color: "#f97316",
      maxCapacity: 1,
    },
    enrollments: [{
      id: pts.id,
      clientId: pts.plan.clientId,
      client: {
        id: pts.plan.client.id,
        firstName: pts.plan.client.firstName,
        lastName: pts.plan.client.lastName,
        phone: pts.plan.client.phone ?? null,
      },
    }],
  }))

  const allSlots = [...slots, ...transformedPtSlots] as Slot[]

  return (
    <>
      <Header title="Calendario de clases" />
      <main className="flex-1 p-3 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Programación semanal</h2>
          <CreateSlotDialog classes={classes} />
        </div>
        <div className="bg-white rounded-lg border overflow-hidden">
          <WeeklyGrid slots={allSlots} />
        </div>
        <p className="text-xs text-gray-400 mt-3">Haz clic en cualquier clase para ver o gestionar los clientes inscritos.</p>
      </main>
    </>
  )
}
