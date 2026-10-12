import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus, Pencil } from "lucide-react"

// Planes en una tabla tipo Excel, agrupados por programa ("Elite Athlete — Head Coach — 8 sesiones (Regular)"
// → programa "Elite Athlete", detalle "Head Coach · 8 sesiones (Regular)").
const PROGRAM_ORDER = ["Elite Athlete", "Elite Athlete Parejas", "Prime Athlete", "Fortia X"]

export default async function MembershipsPage() {
  const plans = await prisma.membershipPlan.findMany({
    where: { isActive: true },
    include: { _count: { select: { clients: { where: { isActive: true } } } } },
  })

  const groups = new Map<string, typeof plans>()
  for (const p of plans) {
    const program = p.name.split(" — ")[0].trim()
    groups.set(program, [...(groups.get(program) ?? []), p])
  }
  const programs = [...groups.keys()].sort((a, b) => {
    const ia = PROGRAM_ORDER.indexOf(a), ib = PROGRAM_ORDER.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
  })

  return (
    <main className="flex-1 p-3 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Planes disponibles</h2>
          <p className="text-xs text-gray-500">{plans.length} planes · {plans.reduce((n, p) => n + p._count.clients, 0)} clientes activos</p>
        </div>
        <Link href="/memberships/new">
          <Button className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo plan
          </Button>
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No hay planes de membresía. Crea el primero.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr className="border-b border-gray-200">
                <th className="text-left font-semibold px-3 py-2">Plan</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Duración</th>
                <th className="text-right font-semibold px-3 py-2">Precio</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Por día</th>
                <th className="text-right font-semibold px-3 py-2">Activos</th>
                <th className="w-10" />
              </tr>
            </thead>
            {programs.map((program) => {
              const rows = groups.get(program)!.sort((a, b) => a.durationDays - b.durationDays || a.price - b.price || a.name.localeCompare(b.name))
              return (
                <tbody key={program}>
                  <tr className="bg-orange-50/60 border-b border-gray-200">
                    <td colSpan={6} className="px-3 py-1.5 text-xs font-bold text-orange-700 uppercase tracking-wide">
                      {program} <span className="font-normal text-gray-500 normal-case">· {rows.length} planes</span>
                    </td>
                  </tr>
                  {rows.map((p) => {
                    const detail = p.name.split(" — ").slice(1).join(" · ") || p.name
                    return (
                      <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-800">{detail}</td>
                        <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">{p.durationDays} días</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(p.price)}</td>
                        <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">S/ {(p.price / p.durationDays).toFixed(2)}</td>
                        <td className={`px-3 py-2 text-right ${p._count.clients ? "font-semibold text-gray-900" : "text-gray-300"}`}>{p._count.clients}</td>
                        <td className="px-2 py-2 text-right">
                          <Link href={`/memberships/${p.id}/edit`} title="Editar plan" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-orange-600">
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              )
            })}
          </table>
        </div>
      )}
    </main>
  )
}
