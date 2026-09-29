import Link from "next/link"
import { Pencil } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { formatDate } from "@/lib/utils"
import { Panel } from "@/components/coaching/kit"
import RenewalBadge from "@/components/clients/RenewalBadge"
import WhatsAppButton from "@/components/clients/WhatsAppButton"
import AddPaymentDialog from "@/components/clients/AddPaymentDialog"
import ExtendPlanDialog from "@/components/clients/ExtendPlanDialog"
import PaymentHistory from "@/components/clients/PaymentHistory"
import ClientSchedulePanel from "@/components/clients/ClientSchedulePanel"
import PersonalTrainingSection from "@/components/clients/PersonalTrainingSection"

// Membresía, pagos, horarios y entrenamiento personal del cliente: los mismos
// datos y acciones que la ficha de "Clientes", dentro del coaching.

export default async function MembershipTab({ clientId }: { clientId: string }) {
  const [client, plans, allSlots, trainingPlans] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      include: {
        membershipPlan: true,
        payments: { orderBy: { paidAt: "desc" }, include: { income: { select: { currency: true } } } },
        enrollments: { include: { slot: { include: { class: true } } } },
      },
    }),
    prisma.membershipPlan.findMany({ where: { isActive: true } }),
    prisma.scheduleSlot.findMany({ where: { isActive: true }, include: { class: true }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }),
    prisma.clientTrainingPlan.findMany({
      where: { clientId },
      include: {
        sessions: { orderBy: [{ isRescheduled: "asc" }, { sessionNumber: "asc" }] },
        scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])
  if (!client) return null
  const fullName = `${client.firstName} ${client.lastName}`

  const serializedPlans = trainingPlans.map((plan) => ({
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    currentPackStart: plan.currentPackStart?.toISOString() ?? null,
    sessions: plan.sessions.map((s) => ({
      ...s,
      scheduledDate: s.scheduledDate?.toISOString() ?? null,
      completedAt: s.completedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    })),
    scheduleSlots: plan.scheduleSlots.map((sl) => ({ ...sl, createdAt: sl.createdAt.toISOString(), updatedAt: sl.updatedAt.toISOString() })),
  }))

  return (
    <div className="grid lg:grid-cols-3 gap-4 items-start">
      <div className="space-y-4">
        <Panel
          title={<span className="flex items-center gap-2">🎟️ Membresía <RenewalBadge membershipEnd={client.membershipEnd} /></span>}
          action={
            <Link href={`/clients/${clientId}/edit?from=coaching`} className="text-xs text-orange-600 flex items-center gap-1">
              <Pencil className="h-3 w-3" /> Editar
            </Link>
          }
        >
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-500">Plan</dt><dd className="font-medium">{client.membershipPlan?.name ?? "Sin plan"}</dd>
            <dt className="text-gray-500">Inicio</dt><dd>{formatDate(client.membershipStart)}</dd>
            <dt className="text-gray-500">Vencimiento</dt><dd>{formatDate(client.membershipEnd)}</dd>
            <dt className="text-gray-500">DNI</dt><dd>{client.dni ?? "—"}</dd>
            <dt className="text-gray-500">Teléfono</dt><dd>{client.phone ?? "—"}</dd>
            <dt className="text-gray-500">Entrenador</dt><dd>{client.trainer ?? "—"}</dd>
          </dl>
          {client.firstName2 && (
            <p className="mt-3 text-xs bg-blue-50 text-blue-700 rounded-lg p-2">
              👥 Persona 2: {client.firstName2} {client.lastName2}{client.dni2 ? ` · DNI ${client.dni2}` : ""}{client.phone2 ? ` · ${client.phone2}` : ""}
            </p>
          )}
          {client.notes && <p className="mt-2 text-xs bg-gray-50 text-gray-700 rounded-lg p-2">📝 {client.notes}</p>}
          <div className="pt-3 flex flex-wrap gap-2">
            <AddPaymentDialog clientId={client.id} clientName={fullName} plans={plans} currentPlanId={client.membershipPlanId} />
            <ExtendPlanDialog clientId={client.id} membershipEnd={client.membershipEnd ? client.membershipEnd.toISOString() : null} />
            <WhatsAppButton phone={client.phone} name={fullName} membershipEnd={client.membershipEnd} />
          </div>
        </Panel>

        <Panel title="💳 Historial de pagos">
          <PaymentHistory payments={client.payments} />
        </Panel>
      </div>

      <Panel className="lg:col-span-1">
        <PersonalTrainingSection clientId={client.id} initialPlans={serializedPlans} />
        <p className="text-[11px] text-gray-400 mt-3">📱 = clase registrada por el cliente desde su app.</p>
      </Panel>

      <Panel title="🗓️ Horarios de clases grupales">
        <ClientSchedulePanel
          clientId={client.id}
          enrollments={client.enrollments.map((e) => ({ slotId: e.slotId, slot: e.slot }))}
          allSlots={allSlots}
        />
      </Panel>
    </div>
  )
}
