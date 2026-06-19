import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import Header from "@/components/layout/Header"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Clock, Users, Pencil } from "lucide-react"

export default async function MembershipsPage() {
  const plans = await prisma.membershipPlan.findMany({
    where: { isActive: true },
    orderBy: { durationDays: "asc" },
    include: { _count: { select: { clients: { where: { isActive: true } } } } },
  })

  return (
    <>
      <Header title="Membresías" />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Planes disponibles</h2>
          <Link href="/memberships/new">
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo plan
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <Card key={plan.id} className="relative">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <p className="text-3xl font-bold text-orange-500">{formatCurrency(plan.price)}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {plan.description && (
                  <p className="text-sm text-gray-500">{plan.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {plan.durationDays} días
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {plan._count.clients} activos
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  S/ {(plan.price / plan.durationDays).toFixed(2)} / día
                </Badge>
                <div className="pt-1">
                  <Link href={`/memberships/${plan.id}/edit`}>
                    <Button variant="outline" size="sm" className="w-full text-xs h-8 gap-1">
                      <Pencil className="h-3 w-3" />
                      Editar plan
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {plans.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No hay planes de membresía. Crea el primero.</p>
          </div>
        )}
      </main>
    </>
  )
}
