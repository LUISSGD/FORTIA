import { prisma } from "@/lib/prisma"
import { formatDate } from "@/lib/utils"
import Header from "@/components/layout/Header"
import RenewalBadge from "@/components/clients/RenewalBadge"
import WhatsAppButton from "@/components/clients/WhatsAppButton"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, User } from "lucide-react"
import { addDays } from "date-fns"
import DeleteButton from "@/components/ui/DeleteButton"

export default async function ClientsPage({
  searchParams,
}: PageProps<"/clients">) {
  const params = await searchParams
  const search = (params?.search as string) ?? ""
  const now = new Date()
  const sevenDays = addDays(now, 7)

  const clients = await prisma.client.findMany({
    where: {
      isActive: true,
      ...(search && {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { dni: { contains: search } },
        ],
      }),
    },
    include: { membershipPlan: true },
    orderBy: { createdAt: "desc" },
  })

  const expiring = clients.filter((c) => {
    if (!c.membershipEnd) return false
    const end = new Date(c.membershipEnd)
    return end >= now && end <= sevenDays
  })

  return (
    <>
      <Header title="Clientes" />
      <main className="flex-1 p-3 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Clientes registrados ({clients.length})
          </h2>
          <Link href="/clients/new">
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo cliente
            </Button>
          </Link>
        </div>

        {expiring.length > 0 && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm font-medium text-orange-700 mb-1">
              ⚠ {expiring.length} cliente(s) con membresía próxima a vencer:
            </p>
            <div className="flex flex-wrap gap-2">
              {expiring.map((c) => (
                <Link key={c.id} href={`/clients/${c.id}`} className="text-xs text-orange-600 underline">
                  {c.firstName} {c.lastName}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <form className="mb-4">
          <input
            name="search"
            defaultValue={search}
            placeholder="Buscar por nombre, DNI..."
            className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </form>

        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    <Link href={`/clients/${client.id}`} className="flex items-center gap-2 hover:text-orange-500">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>
                        {client.firstName} {client.lastName}
                        {client.firstName2 && (
                          <span className="text-xs text-gray-400 block">+ {client.firstName2} {client.lastName2}</span>
                        )}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-gray-600">{client.dni ?? "—"}</TableCell>
                  <TableCell className="text-gray-600">{client.phone ?? "—"}</TableCell>
                  <TableCell className="text-gray-600">{client.membershipPlan?.name ?? "Sin plan"}</TableCell>
                  <TableCell className="text-gray-600">{formatDate(client.membershipEnd)}</TableCell>
                  <TableCell><RenewalBadge membershipEnd={client.membershipEnd} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <WhatsAppButton
                        phone={client.phone}
                        name={`${client.firstName} ${client.lastName}`}
                        membershipEnd={client.membershipEnd}
                      />
                      <DeleteButton
                        url={`/api/clients/${client.id}`}
                        confirm={`¿Eliminar a ${client.firstName} ${client.lastName}?`}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {clients.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">No se encontraron clientes.</div>
          )}
        </div>
      </main>
    </>
  )
}
