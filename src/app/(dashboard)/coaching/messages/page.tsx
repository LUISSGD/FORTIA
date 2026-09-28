import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { dateTimeLima } from "@/lib/coaching/dates"
import { Panel } from "@/components/coaching/kit"
import ChatPanel from "@/components/coaching/ChatPanel"
import Broadcast from "./Broadcast"

export const dynamic = "force-dynamic"

export default async function MessagesPage({ searchParams }: PageProps<"/coaching/messages">) {
  const sp = await searchParams
  const selected = typeof sp.c === "string" ? sp.c : null

  const profiles = await prisma.coachingProfile.findMany({
    where: { status: { not: "ENDED" } },
    include: {
      client: {
        select: {
          id: true, firstName: true, lastName: true,
          coachMessages: { orderBy: { createdAt: "desc" }, take: 1 },
          _count: { select: { coachMessages: { where: { sender: "CLIENT", readAt: null } } } },
        },
      },
    },
  })
  const convos = profiles
    .map((p) => ({ id: p.client.id, name: `${p.client.firstName} ${p.client.lastName}`, last: p.client.coachMessages[0] ?? null, unread: p.client._count.coachMessages }))
    .sort((a, b) => (b.last?.createdAt.getTime() ?? 0) - (a.last?.createdAt.getTime() ?? 0))

  let messages: Awaited<ReturnType<typeof prisma.coachMessage.findMany>> = []
  if (selected) {
    ;[messages] = await Promise.all([
      prisma.coachMessage.findMany({ where: { clientId: selected }, orderBy: { createdAt: "asc" }, take: 300 }),
      prisma.coachMessage.updateMany({ where: { clientId: selected, sender: "CLIENT", readAt: null }, data: { readAt: new Date() } }),
    ])
  }
  const current = convos.find((c) => c.id === selected)

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mensajes</h1>
        <Broadcast clients={convos.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <Panel className={cn("p-0 overflow-hidden", selected && "hidden md:block")}>
          <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
            {convos.map((c) => (
              <li key={c.id}>
                <Link href={`?c=${c.id}`} className={cn("flex items-center gap-3 px-4 py-3 hover:bg-gray-50", c.id === selected && "bg-orange-50")}>
                  <div className="h-9 w-9 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center shrink-0">{c.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium flex justify-between gap-2">
                      <span className="truncate">{c.name}</span>
                      {c.last && <span className="text-[10px] text-gray-400 shrink-0">{dateTimeLima(c.last.createdAt)}</span>}
                    </p>
                    <p className={cn("text-xs truncate", c.unread ? "text-gray-900 font-medium" : "text-gray-500")}>
                      {c.last ? `${c.last.sender === "CLIENT" ? "" : "Tú: "}${c.last.body || "📎 Adjunto"}` : "Sin mensajes"}
                    </p>
                  </div>
                  {c.unread > 0 && <span className="text-[10px] bg-orange-500 text-white rounded-full px-1.5">{c.unread}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className={cn("md:col-span-2 p-0 overflow-hidden", !selected && "hidden md:block")}>
          {current ? (
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Link href="/coaching/messages" className="md:hidden text-sm text-gray-500">←</Link>
                <Link href={`/coaching/clients/${current.id}`} className="font-semibold hover:text-orange-600">{current.name}</Link>
              </div>
              <ChatPanel key={current.id} mode="coach" clientId={current.id} className="h-[62vh]" initialMessages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))} />
            </>
          ) : (
            <p className="text-sm text-gray-500 text-center py-20">Selecciona una conversación</p>
          )}
        </Panel>
      </div>
    </>
  )
}
