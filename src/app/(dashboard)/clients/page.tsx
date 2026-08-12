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
export const dynamic = "force-dynamic"

export default async function ClientsPage({
  searchParams,
}: PageProps<"/clients">) {
  const params = await searchParams
  const search = (params?.search as string) ?? ""
  const programa = (params?.programa as string) ?? ""
  const entrenador = (params?.entrenador as string) ?? ""
  const now = new Date()
  const sevenDays = addDays(now, 7)

  const ENTRENADOR_KEYWORD: Record<string, string> = {
    "head-coach":  "Head Coach",
    "team-fortia": "Team Fortia",
  }

  // Build membership plan filter — case-insensitive, combinable via AND
  type NameFilter = { name: { contains: string; mode: "insensitive" } }
  const planConditions: (NameFilter | { NOT: NameFilter })[] = []

  if (programa === "elite-parejas") {
    planConditions.push({ name: { contains: "Parejas", mode: "insensitive" } })
  } else if (programa === "elite-individual") {
    planConditions.push({ name: { contains: "Elite Athlete", mode: "insensitive" } })
    planConditions.push({ NOT: { name: { contains: "Parejas", mode: "insensitive" } } })
  } else if (programa === "prime") {
    planConditions.push({ name: { contains: "Prime", mode: "insensitive" } })
  } else if (programa === "fortia-x") {
    planConditions.push({ name: { contains: "Fortia X", mode: "insensitive" } })
  }

  if (entrenador && ENTRENADOR_KEYWORD[entrenador]) {
    planConditions.push({ name: { contains: ENTRENADOR_KEYWORD[entrenador], mode: "insensitive" } })
  }

  const membershipPlanWhere =
    planConditions.length === 0 ? null
    : planConditions.length === 1 ? planConditions[0]
    : { AND: planConditions }

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
      ...(programa === "none"
        ? { membershipPlanId: null }
        : membershipPlanWhere
        ? { membershipPlan: membershipPlanWhere }
        : {}),
    },
    include: { membershipPlan: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
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

        {/* Search + filters */}
        <form className="mb-4 flex flex-wrap gap-2">
          <input
            name="search"
            defaultValue={search}
            placeholder="Buscar por nombre, DNI..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 w-48"
          />
          <select
            name="programa"
            defaultValue={programa}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
          >
            <option value="">Todos los programas</option>
            <option value="elite-individual">Elite Athlete</option>
            <option value="elite-parejas">Elite Athlete Parejas</option>
            <option value="prime">Prime Athlete</option>
            <option value="fortia-x">Fortia X</option>
            <option value="none">Sin plan</option>
          </select>
          <select
            name="entrenador"
            defaultValue={entrenador}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
          >
            <option value="">Todos los entrenadores</option>
            <option value="head-coach">Head Coach</option>
            <option value="team-fortia">Team Fortia</option>
          </select>
          <button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 rounded-lg"
          >
            Filtrar
          </button>
          {(search || programa || entrenador) && (
            <a href="/clients" className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">
              Limpiar
            </a>
          )}
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
