"use client"

import { useEffect, useRef, useState } from "react"
import { Paperclip, Send, FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export type ChatMessage = {
  id: string
  sender: string
  body: string
  attachmentUrl: string | null
  attachmentType: string | null
  createdAt: string
}

function time(d: string) {
  return new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d))
}

/**
 * Chat entrenador ↔ cliente. `mode` determina qué lado es "mío".
 * Hace polling cada 6 s mientras la pestaña está visible.
 */
export default function ChatPanel({
  mode,
  clientId,
  initialMessages,
  dark = false,
  className,
}: {
  mode: "coach" | "client"
  clientId?: string
  initialMessages: ChatMessage[]
  dark?: boolean
  className?: string
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const url = mode === "coach" ? `/api/coaching/messages/${clientId}` : "/api/app/messages"
  const mine = mode === "coach" ? "COACH" : "CLIENT"

  useEffect(() => setMessages(initialMessages), [initialMessages])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length])

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return
      const res = await fetch(url)
      if (res.ok) setMessages(await res.json())
    }
    const id = setInterval(tick, 6000)
    return () => clearInterval(id)
  }, [url])

  async function upload(file: File) {
    const fd = new FormData()
    fd.append("file", file)
    if (mode === "client") {
      if (text.trim()) fd.append("body", text.trim())
      const res = await fetch(url, { method: "POST", body: fd })
      return res
    }
    const up = await fetch("/api/coaching/upload", { method: "POST", body: fd })
    const data = await up.json()
    if (!up.ok) return up
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text.trim(), attachmentUrl: data.url, attachmentType: data.type }),
    })
  }

  async function send(file?: File) {
    if (!file && !text.trim()) return
    setSending(true)
    try {
      const res = file
        ? await upload(file)
        : await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "No se pudo enviar")
      setMessages((m) => [...m, data])
      setText("")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div className={cn("flex-1 overflow-y-auto space-y-2 p-3", dark ? "bg-zinc-950" : "bg-gray-50")}>
        {messages.length === 0 && (
          <p className={cn("text-sm text-center py-10", dark ? "text-zinc-500" : "text-gray-400")}>
            {mode === "client" ? "Escríbele a tu coach: dudas, molestias, cómo te sentiste…" : "Aún no hay mensajes."}
          </p>
        )}
        {messages.map((m) => {
          const isMine = m.sender === mine || (mode === "coach" && m.sender === "SYSTEM")
          return (
            <div key={m.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                  isMine
                    ? "bg-orange-500 text-white rounded-br-sm"
                    : dark
                      ? "bg-zinc-800 text-zinc-100 rounded-bl-sm"
                      : "bg-white text-gray-900 rounded-bl-sm border border-gray-100"
                )}
              >
                {m.sender === "SYSTEM" && <p className="text-[10px] uppercase tracking-wide opacity-70 mb-0.5">Automático</p>}
                {m.attachmentUrl && m.attachmentType === "IMAGE" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={m.attachmentUrl} target="_blank" rel="noreferrer"><img src={m.attachmentUrl} alt="" className="rounded-lg mb-1 max-h-60 object-cover" /></a>
                )}
                {m.attachmentUrl && m.attachmentType === "VIDEO" && <video src={m.attachmentUrl} controls className="rounded-lg mb-1 max-h-60" />}
                {m.attachmentUrl && m.attachmentType === "AUDIO" && <audio src={m.attachmentUrl} controls className="mb-1 max-w-full" />}
                {m.attachmentUrl && m.attachmentType === "FILE" && (
                  <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline mb-1">
                    <FileText className="h-4 w-4" /> Archivo adjunto
                  </a>
                )}
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                <p className={cn("text-[10px] mt-0.5 text-right", isMine ? "text-orange-100" : dark ? "text-zinc-500" : "text-gray-400")}>{time(m.createdAt)}</p>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <form
        className={cn("flex items-end gap-2 p-2 border-t", dark ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200")}
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) send(f)
            e.target.value = ""
          }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} className={cn("p-2 rounded-full", dark ? "text-zinc-400 hover:bg-zinc-800" : "text-gray-500 hover:bg-gray-100")} aria-label="Adjuntar">
          <Paperclip className="h-5 w-5" />
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={1}
          placeholder="Escribe un mensaje…"
          className={cn(
            "flex-1 resize-none rounded-2xl px-3 py-2 text-sm outline-none max-h-32",
            dark ? "bg-zinc-800 text-white placeholder:text-zinc-500" : "bg-gray-100 text-gray-900"
          )}
        />
        <button type="submit" disabled={sending || !text.trim()} className="p-2 rounded-full bg-orange-500 text-white disabled:opacity-40" aria-label="Enviar">
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </form>
    </div>
  )
}
