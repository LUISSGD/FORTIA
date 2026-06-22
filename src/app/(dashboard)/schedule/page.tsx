import { prisma } from "@/lib/prisma"
import Header from "@/components/layout/Header"
import WeeklyGrid from "@/components/schedule/WeeklyGrid"
import CreateSlotDialog from "@/components/schedule/CreateSlotDialog"

export default async function SchedulePage() {
  const [slots, classes] = await Promise.all([
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
  ])

  return (
    <>
      <Header title="Calendario de clases" />
      <main className="flex-1 p-3 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Programación semanal</h2>
          <CreateSlotDialog classes={classes} />
        </div>
        <div className="bg-white rounded-lg border overflow-hidden">
          <WeeklyGrid slots={slots} />
        </div>
        <p className="text-xs text-gray-400 mt-3">Haz clic en cualquier clase para ver o gestionar los clientes inscritos.</p>
      </main>
    </>
  )
}
