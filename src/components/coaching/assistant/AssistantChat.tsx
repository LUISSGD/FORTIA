"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowUp, Copy, History, MessageCircle, Plus, Square, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Btn, Textarea } from "@/components/coaching/kit"
import type { Part, Turn } from "@/lib/assistant/store"
import type { Draft } from "@/lib/assistant/tools"
import Markdown from "./Markdown"

type Spend = { spentUsd: number; limitUsd: number }
type Conversation = { id: string; title: string; updatedAt: string }

const IDEAS = [
  "¿Qué tengo que atender hoy?",
  "¿Quién no me ha pagado?",
  "¿Quién está en riesgo de irse?",
  "¿Cómo van los ingresos de este mes contra el anterior?",
  "¿Qué rutinas tengo que renovar?",
  "Dame 3 ideas de contenido con guion",
]

function DraftCard({ draft }: { draft: Draft }) {
  const [text, setText] = useState(draft.text)
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
      <p className="mb-2 text-xs font-semibold text-emerald-900">Borrador para {draft.name} · no se ha enviado</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(10, Math.max(3, Math.ceil(text.length / 60)))} aria-label={`Mensaje para ${draft.name}`} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {draft.url ? (
          <a href={draft.url.replace(/text=$/, `text=${encodeURIComponent(text)}`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-sm font-medium text-white hover:bg-emerald-700">
            <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
          </a>
        ) : (
          <Link href={draft.href} className="text-sm font-medium text-amber-700 underline underline-offset-2">Sin celular: agrégalo aquí</Link>
        )}
        <Btn variant="outline" onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Mensaje copiado"), () => toast.error("No se pudo copiar"))}><Copy className="h-4 w-4" /> Copiar</Btn>
      </div>
    </div>
  )
}

function Answer({ parts, busy }: { parts: Part[]; busy?: boolean }) {
  // Las consultas seguidas se muestran en una sola línea
  const groups: ({ kind: "tools"; labels: string[] } | { kind: "part"; part: Part })[] = []
  for (const p of parts) {
    const last = groups.at(-1)
    if (p.type !== "tool") groups.push({ kind: "part", part: p })
    else if (last?.kind === "tools") { if (!last.labels.includes(p.label)) last.labels.push(p.label) }
    else groups.push({ kind: "tools", labels: [p.label] })
  }
  return (
    <div className="space-y-3">
      {groups.map((g, i) =>
        g.kind === "tools" ? <p key={i} className="text-xs text-gray-400">{g.labels.join(" · ")}</p>
        : g.part.type === "text" ? <Markdown key={i} text={g.part.text} />
        : g.part.type === "draft" ? <DraftCard key={i} draft={g.part.draft} /> : null,
      )}
      {busy && <p className="animate-pulse text-xs text-gray-400" role="status">{parts.length ? "…" : "Pensando…"}</p>}
    </div>
  )
}

export default function AssistantChat({ ready, initialConversations, initialSpend }: { ready: boolean; initialConversations: Conversation[]; initialSpend: Spend }) {
  const [conversations, setConversations] = useState(initialConversations)
  const [spend, setSpend] = useState(initialSpend)
  const [id, setId] = useState<string | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }) }, [turns])
  useEffect(() => () => abort.current?.abort(), [])

  const refresh = () => fetch("/api/coaching/asistente").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setConversations(d.conversations); setSpend(d.spend) } }).catch(() => {})

  async function open(cid: string) {
    if (busy) return
    setShowHistory(false)
    const r = await fetch(`/api/coaching/asistente/${cid}`).catch(() => null)
    if (!r?.ok) { toast.error("No se pudo abrir la conversación"); return }
    const d = await r.json()
    setId(d.id)
    setTurns(d.turns)
  }

  function startNew() {
    if (busy) return
    setShowHistory(false)
    setId(null)
    setTurns([])
  }

  async function remove(cid: string) {
    const r = await fetch(`/api/coaching/asistente/${cid}`, { method: "DELETE" }).catch(() => null)
    if (!r?.ok) { toast.error("No se pudo borrar"); return }
    setConversations((l) => l.filter((c) => c.id !== cid))
    if (cid === id) startNew()
  }

  async function ask(q: string) {
    const question = q.trim()
    if (!question || busy || !ready) return
    const before = turns
    const fail = (message: string) => { toast.error(message); setTurns(before); setText(question) }
    setText("")
    setBusy(true)
    setTurns([...before, { role: "user", text: question }, { role: "assistant", parts: [] }])
    const parts: Part[] = []
    const paint = () => setTurns([...before, { role: "user", text: question }, { role: "assistant", parts: [...parts] }])
    const ctrl = (abort.current = new AbortController())
    let saved = false
    try {
      const res = await fetch("/api/coaching/asistente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, conversationId: id }), signal: ctrl.signal })
      if (!res.ok || !res.body) { fail((await res.json().catch(() => null))?.error ?? "No se pudo completar la respuesta."); return }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ""
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line) continue
          const e = JSON.parse(line)
          const last = parts.at(-1)
          if (e.type === "text") { if (last?.type === "text") parts[parts.length - 1] = { type: "text", text: last.text + e.text }; else parts.push({ type: "text", text: e.text }) }
          else if (e.type === "tool") parts.push({ type: "tool", label: e.label })
          else if (e.type === "draft") parts.push({ type: "draft", draft: e.draft })
          else if (e.type === "restart") { if (last?.type === "text") parts.pop() }
          else if (e.type === "saved") { saved = true; setId(e.id); setSpend(e.spend) }
          else if (e.type === "error") { fail(e.message); refresh(); return }
        }
        paint()
      }
      if (!saved) fail("La respuesta se cortó. Vuelve a intentarlo.")
      else refresh()
    } catch {
      if (ctrl.signal.aborted) { setTurns(before); setText(question) }
      else fail("Se perdió la conexión. Vuelve a intentarlo.")
      refresh()
    } finally {
      abort.current = null
      setBusy(false)
    }
  }

  const pct = Math.min(100, Math.round((spend.spentUsd / spend.limitUsd) * 100))

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 pb-24 md:pb-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Asistente</h1>
          <p className="text-xs text-gray-500">Consulta tus datos y prepara borradores. No cambia ni envía nada.</p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="outline" size="sm" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory} disabled={busy}><History className="h-3.5 w-3.5" /> Anteriores</Btn>
          <Btn size="sm" onClick={startNew} disabled={busy}><Plus className="h-3.5 w-3.5" /> Nueva</Btn>
        </div>
      </header>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200" aria-hidden><span className={cn("block h-full", pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-gray-800")} style={{ width: `${pct}%` }} /></span>
        <span className="tabular-nums">US$ {spend.spentUsd.toFixed(2)} de {spend.limitUsd} este mes</span>
      </div>

      {showHistory && (
        <div className="rounded-xl border border-gray-200 bg-white p-2">
          {conversations.length === 0 && <p className="p-2 text-sm text-gray-400">Todavía no hay conversaciones.</p>}
          {conversations.map((c) => (
            <div key={c.id} className={cn("flex items-center gap-1 rounded-lg hover:bg-gray-50", c.id === id && "bg-gray-100")}>
              <button type="button" onClick={() => open(c.id)} className="min-w-0 flex-1 truncate px-2 py-2 text-left text-sm text-gray-700">{c.title}</button>
              <button type="button" onClick={() => remove(c.id)} aria-label={`Borrar ${c.title}`} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <p className="px-2 pt-1 text-[11px] text-gray-400">Se borran solas a los 60 días sin uso.</p>
        </div>
      )}

      {!ready && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Falta conectar la IA</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Entra a platform.claude.com, crea tu cuenta y carga saldo.</li>
            <li>En <b>API keys</b>, crea una clave.</li>
            <li>En Vercel → proyecto fortia → Settings → Environment Variables, agrega <b>ANTHROPIC_API_KEY</b> con esa clave.</li>
            <li>Vuelve a publicar: Deployments → los tres puntos del último → Redeploy.</li>
          </ol>
          <p className="mt-2">No pegues la clave en ningún chat.</p>
        </div>
      )}

      <div className="space-y-5">
        {turns.length === 0 && ready && (
          <div className="grid gap-2 sm:grid-cols-2">
            {IDEAS.map((q) => <button key={q} type="button" onClick={() => ask(q)} className="rounded-xl border border-gray-200 bg-white p-3 text-left text-sm text-gray-700 hover:border-gray-400">{q}</button>)}
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end"><p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-gray-900 px-3.5 py-2 text-sm text-white">{t.text}</p></div>
          ) : (
            <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4"><Answer parts={t.parts} busy={busy && i === turns.length - 1} /></div>
          ),
        )}
        <div ref={bottom} className="h-px scroll-mb-40" />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(text) }} className="sticky bottom-20 z-10 flex items-end gap-2 rounded-2xl border border-gray-300 bg-white p-2 shadow-sm md:bottom-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(text) } }}
          rows={Math.min(6, Math.max(1, text.split("\n").length))}
          maxLength={3000}
          disabled={!ready}
          placeholder="Pregúntale a tu negocio…"
          aria-label="Pregunta para el asistente"
          className="min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-base outline-none md:text-sm"
        />
        {busy ? (
          <button type="button" onClick={() => abort.current?.abort()} aria-label="Detener" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gray-200 text-gray-800"><Square className="h-4 w-4" /></button>
        ) : (
          <button type="submit" disabled={!text.trim() || !ready} aria-label="Enviar" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gray-900 text-white disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
        )}
      </form>
      <p className="text-center text-[11px] text-gray-400">Puede equivocarse: confirma lo importante en su pantalla. Tus preguntas y los datos que consulta se procesan con la IA de Anthropic; no recibe celulares, correos, DNI ni datos de salud de la base.</p>
    </div>
  )
}
