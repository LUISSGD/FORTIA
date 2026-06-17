import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { formatDate, formatDateTime, formatCurrency, PAYMENT_METHODS } from "@/lib/utils"
import Header from "@/components/layout/Header"
import RenewalBadge from "@/components/clients/RenewalBadge"
import WhatsAppButton from "@/components/clients/WhatsAppButton"
import AddPaymentDialog from "@/components/clients/AddPaymentDialog"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Pencil } from "lucide-react"

export default async function ClientDetailPage({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params

  const [client, plans] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: {
        membershipPlan: true,
        payments: { orderBy: { paidAt: "desc" } },
        enrollments: { include: { slot: { include: { class: true } } } },
      },
    }),
    prisma.membershipPlan.findMany({ where: { isActive: true } }),
  ])

  if (!client) notFound()

  const fullName = `${client.firstName} ${client.lastName}`

  return (
    <>
      <Header title="Detalle de cliente" />
      <main className="flex-1 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/clients">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-xl font-semibold">{fullName}</h1>
          <RenewalBadge membershipEnd={client.membershipEnd} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Client info */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Información</CardTitle>
              <Link href={`/clients/${id}/edit`}>
                <Button variant="outline" size="sm"><Pencil className="h-3 w-3 mr-1" />Editar</Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><span className="text-gray-500">DNI:</span> <span className="font-medium">{client.dni ?? "—"}</span></div>
              <div><span className="text-gray-500">Teléfono:</span> <span className="font-medium">{client.phone ?? "—"}</span></div>
              <div><span className="text-gray-500">Email:</span> <span className="font-medium">{client.email ?? "—"}</span></div>
              <div><span className="text-gray-500">Plan:</span> <span className="font-medium">{client.membershipPlan?.name ?? "Sin plan"}</span></div>
              <div><span className="text-gray-500">Inicio:</span> <span className="font-medium">{formatDate(client.membershipStart)}</span></div>
              <div><span className="text-gray-500">Vencimiento:</span> <span className="font-medium">{formatDate(client.membershipEnd)}</span></div>
              {client.notes && <div><span className="text-gray-500">Notas:</span> <span className="font-medium">{client.notes}</span></div>}
              <div className="pt-2 flex gap-2">
                <AddPaymentDialog
                  clientId={client.id}
                  clientName={fullName}
                  plans={plans}
                  currentPlanId={client.membershipPlanId}
                />
                <WhatsAppButton phone={client.phone} name={fullName} membershipEnd={client.membershipEnd} />
              </div>
            </CardContent>
          </Card>

          {/* Payments history */}
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-base">Historial de pagos</CardTitle></CardHeader>
            <CardContent>
              {client.payments.length === 0 ? (
                <p className="text-sm text-gray-500">Sin pagos registrados.</p>
              ) : (
                <div className="space-y-3">
                  {client.payments.map((p) => (
                    <div key={p.id} className="border-l-2 border-orange-300 pl-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium">{formatCurrency(p.amount)}</p>
                          <p className="text-xs text-gray-500">{PAYMENT_METHODS[p.method] ?? p.method}</p>
                          <p className="text-xs text-gray-400">{formatDate(p.periodStart)} — {formatDate(p.periodEnd)}</p>
                        </div>
                        <p className="text-xs text-gray-400">{formatDate(p.paidAt)}</p>
                      </div>
                      {p.concept && <p className="text-xs text-gray-500 mt-1">{p.concept}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enrolled classes */}
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-base">Clases inscritas</CardTitle></CardHeader>
            <CardContent>
              {client.enrollments.length === 0 ? (
                <p className="text-sm text-gray-500">No está inscrito en ninguna clase.</p>
              ) : (
                <div className="space-y-2">
                  {client.enrollments.map((e) => (
                    <div key={e.id} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.slot.class.color }} />
                      <div>
                        <p className="text-sm font-medium">{e.slot.class.name}</p>
                        <p className="text-xs text-gray-500">
                          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][e.slot.dayOfWeek]} {e.slot.startTime}–{e.slot.endTime}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
