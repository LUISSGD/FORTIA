import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { LEVELS } from "@/lib/coaching/constants"
import { Panel } from "@/components/coaching/kit"
import NewProgramButton from "./NewProgramButton"

/** Librería de rutinas: plantillas + programas activos de clientes. Compartida por /coaching y /trainer. */
export default async function ProgramsLibrary({ basePath }: { basePath: "/coaching" | "/trainer" }) {
  const [templates, assigned] = await Promise.all([
    prisma.program.findMany({ where: { isTemplate: true }, orderBy: { updatedAt: "desc" }, include: { days: { select: { name: true, _count: { select: { exercises: true } } }, orderBy: { order: "asc" } } } }),
    prisma.program.findMany({
      where: { isTemplate: false, isActive: true, client: { coachingProfile: { status: { not: "ENDED" } } } },
      orderBy: { updatedAt: "desc" },
      include: { client: { select: { firstName: true, lastName: true } }, _count: { select: { days: true } } },
    }),
  ])

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Rutinas</h1>
          <p className="text-sm text-gray-500">Crea plantillas y asígnalas; cada cliente recibe su propia copia editable.</p>
        </div>
        <NewProgramButton basePath={basePath} />
      </div>

      <Panel title={`Plantillas (${templates.length})`}>
        {templates.length === 0 ? (
          <p className="text-sm text-gray-500">Crea tu primera plantilla, por ejemplo “Push/Pull/Legs — Hipertrofia”.</p>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {templates.map((p) => (
              <Link key={p.id} href={`${basePath}/programs/${p.id}`} className="block rounded-xl border border-gray-200 p-4 hover:border-orange-300 hover:shadow-sm transition">
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-gray-500 mb-2">{[p.goal, LEVELS[p.level ?? ""], `${p.days.length} días`, `${p.weeks} semanas`].filter(Boolean).join(" · ")}</p>
                <ul className="text-xs text-gray-600 space-y-0.5">
                  {p.days.map((d, i) => <li key={i}>• {d.name} <span className="text-gray-400">({d._count.exercises})</span></li>)}
                </ul>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={`Programas activos de clientes (${assigned.length})`}>
        {assigned.length === 0 ? (
          <p className="text-sm text-gray-500">Asigna rutinas desde el perfil de cada cliente o desde una plantilla.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {assigned.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between gap-3">
                <Link href={`${basePath}/programs/${p.id}`} className="text-sm font-medium hover:text-orange-600">{p.name}</Link>
                <span className="text-xs text-gray-500 text-right">{p.client?.firstName} {p.client?.lastName} · {p._count.days} días</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
