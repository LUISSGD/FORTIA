"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FileText, Link2, PlayCircle, ImageIcon, Trash2, Upload } from "lucide-react"
import { DOC_CATEGORIES } from "@/lib/coaching/constants"
import { Btn, Field, Input, Select, Textarea } from "./kit"

type Doc = { id: string; title: string; description: string | null; category: string; type: string; url: string; clientId: string | null; clientName: string | null; createdAt: string }

const ICONS: Record<string, typeof FileText> = { PDF: FileText, VIDEO: PlayCircle, LINK: Link2, IMAGE: ImageIcon }

export default function DocumentsManager({ docs, clients, fixedClientId }: { docs: Doc[]; clients: { id: string; name: string }[]; fixedClientId?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: "", description: "", category: "GENERAL", url: "", clientId: fixedClientId ?? "" })
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const fd = new FormData()
    Object.entries(f).forEach(([k, v]) => fd.append(k, v))
    if (file) fd.append("file", file)
    const res = await fetch("/api/coaching/documents", { method: "POST", body: fd })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) return toast.error(data.error ?? "Error")
    toast.success("Documento publicado")
    setOpen(false)
    setFile(null)
    setF({ title: "", description: "", category: "GENERAL", url: "", clientId: fixedClientId ?? "" })
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Btn size="sm" onClick={() => setOpen((o) => !o)}><Upload className="h-3.5 w-3.5" /> Subir documento</Btn>
      </div>
      {open && (
        <div className="p-3 rounded-lg bg-gray-50 space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Título *" className="md:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Guía de alimentación" /></Field>
            <Field label="Categoría">
              <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {Object.entries(DOC_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Descripción"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Archivo (PDF, imagen, video)"><input type="file" accept="application/pdf,image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" /></Field>
            <Field label="…o enlace (YouTube, Drive, web)"><Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" /></Field>
          </div>
          {!fixedClientId && (
            <Field label="Visible para">
              <Select value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}>
                <option value="">Todos los clientes</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          )}
          {fixedClientId && (
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={!f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.checked ? "" : fixedClientId })} />
              Compartir con todos los clientes
            </label>
          )}
          <Btn onClick={save} disabled={busy || !f.title}>{busy ? "Subiendo…" : "Publicar"}</Btn>
        </div>
      )}
      {docs.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">Sin documentos.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {docs.map((d) => {
            const Icon = ICONS[d.type] ?? FileText
            return (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <Icon className="h-5 w-5 text-orange-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:text-orange-600">{d.title}</a>
                  <p className="text-xs text-gray-500 truncate">
                    {DOC_CATEGORIES[d.category] ?? d.category} · {d.clientName ?? "Solo este cliente"} · {d.createdAt}
                    {d.description ? ` · ${d.description}` : ""}
                  </p>
                </div>
                <button
                  className="p-1.5 text-gray-400 hover:text-red-500"
                  onClick={async () => {
                    if (!confirm("¿Eliminar documento?")) return
                    await fetch(`/api/coaching/documents/${d.id}`, { method: "DELETE" })
                    router.refresh()
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
