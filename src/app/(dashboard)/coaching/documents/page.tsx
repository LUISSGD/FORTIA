import { prisma } from "@/lib/prisma"
import { dateTimeLima } from "@/lib/coaching/dates"
import { Panel } from "@/components/coaching/kit"
import DocumentsManager from "@/components/coaching/DocumentsManager"

export const dynamic = "force-dynamic"

export default async function DocumentsPage() {
  const [docs, profiles] = await Promise.all([
    prisma.coachDocument.findMany({ orderBy: { createdAt: "desc" }, include: { client: { select: { firstName: true, lastName: true } } } }),
    prisma.coachingProfile.findMany({ where: { status: "ACTIVE" }, select: { client: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { client: { firstName: "asc" } } }),
  ])
  return (
    <>
      <div>
        <h1 className="text-xl font-bold">Documentos</h1>
        <p className="text-sm text-gray-500">Evaluaciones, guías, reglamento, técnica… Tus clientes los ven en su app.</p>
      </div>
      <Panel>
        <DocumentsManager
          clients={profiles.map((p) => ({ id: p.client.id, name: `${p.client.firstName} ${p.client.lastName}` }))}
          docs={docs.map((d) => ({ id: d.id, title: d.title, description: d.description, category: d.category, type: d.type, url: d.url, clientId: d.clientId, clientName: d.client ? `${d.client.firstName} ${d.client.lastName}` : "Todos", createdAt: dateTimeLima(d.createdAt) }))}
        />
      </Panel>
    </>
  )
}
