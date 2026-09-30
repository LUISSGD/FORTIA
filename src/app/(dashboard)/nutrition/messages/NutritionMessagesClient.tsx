"use client"

import { useState } from "react"
import Link from "next/link"
import ChatPanel, { type ChatMessage } from "@/components/coaching/ChatPanel"
import { Search, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

type Thread = {
  clientId: string
  clientName: string
  lastName: string
  lastBody: string
  lastAt: Date
  unread: boolean
}

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d))

export default function NutritionMessagesClient({ threads }: { threads: Thread[] }) {
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  const filtered = q.trim()
    ? threads.filter((t) => t.clientName.toLowerCase().includes(q.toLowerCase()))
    : threads

  async function openThread(clientId: string) {
    setSelected(clientId)
    setLoading(true)
    const res = await fetch(`/api/nutrition/messages/${clientId}`)
    if (res.ok) setChatMessages(await res.json())
    setLoading(false)
  }

  const selectedThread = threads.find((t) => t.clientId === selected)

  if (selected && selectedThread) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col h-[calc(100vh-7rem)]">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600 shrink-0">
            {selectedThread.clientName[0]}{selectedThread.lastName?.[0] ?? ""}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{selectedThread.clientName}</p>
            <Link href={`/nutrition/clients/${selectedThread.clientId}?tab=chat`} className="text-xs text-orange-500 hover:underline">Ver ficha →</Link>
          </div>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Cargando…</div>
        ) : (
          <div className="flex-1 min-h-0 border border-gray-200 rounded-xl overflow-hidden">
            <ChatPanel
              mode="nutritionist"
              clientId={selected}
              initialMessages={chatMessages}
              channel="NUTRITION"
              className="h-full"
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Mensajes</h1>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar conversación…"
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>
      {filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Sin conversaciones aún</p>}
      <div className="divide-y divide-gray-100 bg-white border border-gray-100 rounded-xl overflow-hidden">
        {filtered.map((t) => (
          <button key={t.clientId} onClick={() => openThread(t.clientId)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left">
            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600 shrink-0">
              {t.clientName[0]}{t.lastName?.[0] ?? ""}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium", t.unread ? "text-gray-900" : "text-gray-700")}>{t.clientName}</p>
              <p className="text-xs text-gray-400 truncate">{t.lastBody}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-xs text-gray-400">{fmtTime(t.lastAt)}</span>
              {t.unread && <span className="h-2 w-2 rounded-full bg-orange-500" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
