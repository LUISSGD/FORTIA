import { redirect } from "next/navigation"
import { FileText, Link2, PlayCircle, ImageIcon } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import { DOC_CATEGORIES } from "@/lib/coaching/constants"
import { formatYmd, toYmd } from "@/lib/coaching/dates"
import { Card, PageTitle } from "@/components/coaching/app/ui"

const ICONS: Record<string, typeof FileText> = { PDF: FileText, VIDEO: PlayCircle, LINK: Link2, IMAGE: ImageIcon }

export default async function DocumentsPage() {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const docs = await prisma.coachDocument.findMany({ where: { OR: [{ clientId: ctx.clientId }, { clientId: null }] }, orderBy: { createdAt: "desc" } })
  const groups = Object.entries(DOC_CATEGORIES).map(([k, label]) => ({ label, docs: docs.filter((d) => d.category === k) })).filter((g) => g.docs.length)
  return (
    <div className="space-y-4">
      <PageTitle title="Documentos" subtitle="Guías y material de tu coach" />
      {docs.length === 0 && <Card><p className="text-sm text-zinc-400">Aún no hay documentos.</p></Card>}
      {groups.map((g) => (
        <div key={g.label}>
          <p className="text-xs font-bold tracking-widest uppercase text-zinc-400 mb-2">{g.label}</p>
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 divide-y divide-zinc-800">
            {g.docs.map((d) => {
              const Icon = ICONS[d.type] ?? FileText
              return (
                <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3.5">
                  <Icon className="h-5 w-5 text-orange-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{d.title}</p>
                    <p className="text-xs text-zinc-500 truncate">{d.description ?? formatYmd(toYmd(d.createdAt), true)}</p>
                  </div>
                  <span className="text-zinc-600">→</span>
                </a>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
