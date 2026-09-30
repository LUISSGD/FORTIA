"use client"

import { useState } from "react"
import Link from "next/link"
import ChatPanel, { type ChatMessage } from "@/components/coaching/ChatPanel"
import { Search, ArrowLeft, MessageSquare, Users } from "lucide-react"
import { cn } from "@/lib/utils"

type Thread = {
  clientId: string
  firstName: string
  lastName: string
  lastBody: string
  lastAt: string
  sender: string
  unread: boolean
}

const AVATAR_COLORS = [
  "from-orange-400 to-orange-500",
  "from-violet-400 to-purple-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-pink-500",
  "from-sky-400 to-blue-500",
  "from-amber-400 to-orange-400",
]

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "ahora"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return "ayer"
  if (days < 7) return `${days}d`
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" }).format(new Date(iso))
}

function ThreadItem({
  thread,
  active,
  onClick,
}: {
  thread: Thread
  active: boolean
  onClick: () => void
}) {
  const initials = `${thread.firstName[0] ?? ""}${thread.lastName?.[0] ?? ""}`.toUpperCase()
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
        active ? "bg-orange-50 border-l-2 border-l-orange-500" : "hover:bg-gray-50 border-l-2 border-l-transparent"
      )}
    >
      <div className="relative shrink-0">
        <div className={cn(
          "h-11 w-11 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-bold text-white shadow-sm",
          avatarColor(thread.firstName)
        )}>
          {initials}
        </div>
        {thread.unread && (
          <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-orange-500 border-2 border-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <p className={cn(
            "text-sm truncate",
            thread.unread ? "font-semibold text-gray-900" : "font-medium text-gray-700"
          )}>
            {thread.firstName} {thread.lastName}
          </p>
          <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">{fmtRelative(thread.lastAt)}</span>
        </div>
        <p className={cn(
          "text-xs mt-0.5 truncate",
          thread.unread ? "text-gray-600" : "text-gray-400"
        )}>
          {thread.sender !== "CLIENT" ? "Tú: " : ""}{thread.lastBody}
        </p>
      </div>
    </button>
  )
}

export default function NutritionMessagesClient({ threads }: { threads: Thread[] }) {
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  const filtered = q.trim()
    ? threads.filter((t) => `${t.firstName} ${t.lastName}`.toLowerCase().includes(q.toLowerCase()))
    : threads

  async function openThread(clientId: string) {
    setSelected(clientId)
    setLoading(true)
    const res = await fetch(`/api/nutrition/messages/${clientId}`)
    if (res.ok) setChatMessages(await res.json())
    setLoading(false)
  }

  const selectedThread = threads.find((t) => t.clientId === selected)

  const threadList = (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar conversación…"
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition"
          />
        </div>
      </div>

      {/* Threads */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="h-6 w-6 text-gray-300" />
            </div>
            <p className="text-sm text-gray-400">
              {q ? "Sin resultados" : "Sin conversaciones aún"}
            </p>
          </div>
        ) : (
          filtered.map((t) => (
            <ThreadItem
              key={t.clientId}
              thread={t}
              active={selected === t.clientId}
              onClick={() => openThread(t.clientId)}
            />
          ))
        )}
      </div>
    </div>
  )

  const chatView = selectedThread ? (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 bg-white shrink-0">
        <button
          onClick={() => setSelected(null)}
          className="md:hidden text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className={cn(
          "h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-bold text-white shadow-sm shrink-0",
          avatarColor(selectedThread.firstName)
        )}>
          {`${selectedThread.firstName[0] ?? ""}${selectedThread.lastName?.[0] ?? ""}`.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            {selectedThread.firstName} {selectedThread.lastName}
          </p>
          <Link
            href={`/nutrition/clients/${selectedThread.clientId}?tab=chat`}
            className="text-xs text-orange-500 hover:text-orange-600"
          >
            Ver ficha completa →
          </Link>
        </div>
      </div>

      {/* Chat */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-orange-300 border-t-orange-500 animate-spin" />
            <p className="text-sm text-gray-400">Cargando conversación…</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ChatPanel
            mode="nutritionist"
            clientId={selected!}
            initialMessages={chatMessages}
            channel="NUTRITION"
            className="h-full"
          />
        </div>
      )}
    </div>
  ) : (
    /* Empty chat state (desktop only) */
    <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center p-8 bg-gray-50/50">
      <div className="h-16 w-16 rounded-2xl bg-orange-100 flex items-center justify-center mb-4 shadow-sm">
        <MessageSquare className="h-8 w-8 text-orange-500" />
      </div>
      <p className="text-base font-semibold text-gray-700">Selecciona una conversación</p>
      <p className="text-sm text-gray-400 mt-1 max-w-xs">
        Elige un cliente de la lista para ver y responder sus mensajes.
      </p>
    </div>
  )

  /* ── Mobile: full-screen chat when thread is selected ── */
  if (selected && selectedThread) {
    return (
      <div className="md:hidden flex flex-col" style={{ height: "calc(100dvh - 7rem)" }}>
        {chatView}
      </div>
    )
  }

  return (
    <>
      {/* Mobile: thread list */}
      <div className="md:hidden flex flex-col">
        <div className="px-4 pt-5 pb-3">
          <h1 className="text-xl font-bold text-gray-900">Mensajes</h1>
          {threads.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{threads.filter(t => t.unread).length > 0 ? `${threads.filter(t => t.unread).length} sin leer` : `${threads.length} conversaciones`}</p>
          )}
        </div>
        {threadList}
      </div>

      {/* Desktop: two-panel */}
      <div className="hidden md:flex" style={{ height: "calc(100vh - 4rem)" }}>
        {/* Sidebar */}
        <div className="w-80 shrink-0 border-r border-gray-100 bg-white flex flex-col">
          <div className="px-4 pt-5 pb-2 shrink-0">
            <div className="flex items-baseline justify-between">
              <h1 className="text-lg font-bold text-gray-900">Mensajes</h1>
              {threads.some(t => t.unread) && (
                <span className="text-xs font-semibold text-orange-500">
                  {threads.filter(t => t.unread).length} nuevos
                </span>
              )}
            </div>
          </div>
          {threadList}
        </div>

        {/* Chat panel */}
        <div className="flex-1 flex flex-col bg-white">
          {chatView}
        </div>
      </div>
    </>
  )
}
