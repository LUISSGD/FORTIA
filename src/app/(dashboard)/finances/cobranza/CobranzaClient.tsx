"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Btn, Field, Input, Modal, Textarea, api } from "@/components/coaching/kit"
import type { CollectionItem } from "@/lib/finance/collections"

// Cobranza del día, pensada para el celular: a quién escribir, con el mensaje listo, y a quién ya se le escribió.

type Data = {
  today: string
  items: CollectionItem[]
  waiting: { clientId: string; name: string; date: string; amount: number }[]
  templates: { key: string; label: string; text: string; edited: boolean }[]
  totalActive: number
  noPhone: { id: string; name: string; phone: string }[]
  recent: { id: string; name: string; step: string; kind: string; outcome: string; at: string; by: string | null }[]
}

const soles = (n: number) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`
const URL_ = "/api/finances/collections"

const GROUPS: { key: string; title: string; hint?: string; tone: string; match: (i: CollectionItem) => boolean }[] = [
  { key: "promise", title: "Hoy prometieron pagar", tone: "text-violet-700", match: (i) => i.step === "PROMISE" },
  { key: "due", title: "Vence hoy", tone: "text-red-600", match: (i) => i.kind === "RENEWAL" && i.step === "DUE" },
  { key: "late", title: "Ya venció", hint: "Siguen activos. Vuelven a aparecer cada semana hasta que paguen o marques que no renuevan.", tone: "text-red-600", match: (i) => i.kind === "RENEWAL" && i.step === "LATE" },
  { key: "balance", title: "Saldos por cobrar", tone: "text-orange-600", match: (i) => i.kind === "BALANCE" && i.step !== "PROMISE" },
  { key: "pre", title: "Vence en los próximos 5 días", tone: "text-amber-600", match: (i) => i.kind === "RENEWAL" && i.step === "PRE" },
  { key: "reactivate", title: "Para reactivar", hint: "En stand-by o marcados como no renueva. Vencieron hace 7 a 60 días.", tone: "text-sky-700", match: (i) => i.step === "REACTIVATE" },
]

function when(i: CollectionItem) {
  if (i.daysLeft === null) return "sin fecha límite"
  if (i.daysLeft === 0) return "vence hoy"
  if (i.daysLeft === 1) return "vence mañana"
  if (i.daysLeft > 0) return `vence en ${i.daysLeft} días`
  return i.daysLeft === -1 ? "venció ayer" : `venció hace ${-i.daysLeft} días`
}

export default function CobranzaClient() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [asking, setAsking] = useState<string | null>(null)
  const [promise, setPromise] = useState<CollectionItem | null>(null)
  const [phones, setPhones] = useState(false)
  const [messages, setMessages] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await api<Data>(URL_))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  useEffect(() => { load() }, [load])

  async function post(body: object, ok?: string) {
    try {
      await api(URL_, "POST", body)
      if (ok) toast.success(ok)
      await load()
      return true
    } catch (e) {
      toast.error((e as Error).message)
      return false
    }
  }

  async function record(i: CollectionItem, outcome: "SENT" | "PROMISED" | "DISMISSED", ok: string, promiseDate?: string) {
    setBusy(i.id)
    const done = await post({ action: "record", clientId: i.clientId, kind: i.kind, step: i.step, cycleKey: i.cycleKey, outcome, promiseDate }, ok)
    setBusy(null)
    setAsking(null)
    return done
  }

  if (error) return <main className="flex-1 p-6 text-sm text-red-600">{error} <button className="underline" onClick={load}>Reintentar</button></main>
  if (!data) return <main className="flex-1 p-6 text-sm text-gray-500">Cargando…</main>

  const toCollect = data.items.filter((i) => i.step !== "REACTIVATE")
  const total = toCollect.reduce((s, i) => s + i.amount, 0)

  return (
    <main className="flex-1 p-3 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4 pb-24">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cobranza de hoy</h1>
            <p className="text-sm text-gray-500">
              {toCollect.length ? <><b className="text-gray-800">{toCollect.length}</b> por cobrar · <b className="text-gray-800">{soles(total)}</b></> : "No tienes cobros pendientes hoy 🎉"}
            </p>
          </div>
          <Btn size="sm" variant="outline" onClick={() => setMessages(true)}>Mensajes</Btn>
        </div>

        {data.noPhone.length > 0 && (
          <button onClick={() => setPhones(true)} className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900">
            📱 <b>{data.noPhone.length} de {data.totalActive} clientes activos no tienen celular.</b> Sin celular no puedes escribirles desde aquí. <span className="underline">Completarlos →</span>
          </button>
        )}

        {GROUPS.map((g) => {
          const rows = data.items.filter(g.match)
          if (!rows.length) return null
          return (
            <section key={g.key} className="space-y-2">
              <div>
                <h2 className={cn("text-sm font-bold", g.tone)}>{g.title} · {rows.length}</h2>
                {g.hint && <p className="text-[11px] text-gray-500">{g.hint}</p>}
              </div>
              <ul className="space-y-2">
                {rows.map((i) => (
                  <li key={i.id} className={cn("rounded-xl border border-gray-200 bg-white p-3 space-y-2", busy === i.id && "opacity-50")}>
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/coaching/clients/${i.clientId}?tab=membership`} className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {i.name}
                          {i.standby && <span className="ml-1.5 rounded bg-gray-100 px-1 text-[10px] font-normal text-gray-500">stand-by</span>}
                        </p>
                        <p className="truncate text-xs text-gray-500">{i.kind === "BALANCE" ? "Saldo · " : ""}{i.plan || "Sin plan"}</p>
                        <p className={cn("text-xs font-medium", g.tone)}>{i.dueDate ? `${dm(i.dueDate)} · ` : ""}{when(i)}</p>
                      </Link>
                      {i.amount > 0 && <p className="shrink-0 text-sm font-bold tabular-nums text-gray-900">{soles(i.amount)}</p>}
                    </div>

                    {asking === i.id ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm">
                        <span className="font-medium text-emerald-900">¿Le enviaste el mensaje?</span>
                        <span className="flex gap-2">
                          <Btn size="sm" disabled={busy === i.id} onClick={() => record(i, "SENT", "Registrado ✓")}>Sí</Btn>
                          <Btn size="sm" variant="outline" onClick={() => setAsking(null)}>No</Btn>
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {i.waUrl ? (
                          <a href={i.waUrl} target="_blank" rel="noreferrer" onClick={() => setAsking(i.id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">WhatsApp</a>
                        ) : (
                          <PhoneInput clientId={i.clientId} initial="" compact onSaved={load} />
                        )}
                        <Btn size="sm" variant="outline" disabled={busy === i.id} onClick={() => record(i, "SENT", "Registrado ✓")}>Ya le escribí</Btn>
                        <Btn size="sm" variant="outline" disabled={busy === i.id} onClick={() => setPromise(i)}>Prometió pagar</Btn>
                        <Link href={`/coaching/clients/${i.clientId}?tab=${i.kind === "BALANCE" ? "payments" : "membership"}`}><Btn size="sm" variant="outline">Registrar pago</Btn></Link>
                        {i.kind === "RENEWAL" && i.step !== "REACTIVATE" && i.dueDate && (
                          <Btn size="sm" variant="ghost" disabled={busy === i.id} onClick={() => confirm(`¿${i.name} no renueva? También se marca en la Proyección.`) && post({ action: "noRenew", clientId: i.clientId, dueDate: i.dueDate }, "Marcado: no renueva")}>No renueva</Btn>
                        )}
                        {i.step === "REACTIVATE" && (
                          <Btn size="sm" variant="ghost" disabled={busy === i.id} onClick={() => confirm(`¿No volver a mostrar a ${i.name} por este vencimiento?`) && record(i, "DISMISSED", "Ya no aparecerá")}>No escribirle</Btn>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}

        {data.waiting.length > 0 && (
          <details className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-700">Prometieron pagar más adelante · {data.waiting.length}</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {data.waiting.map((w, k) => (
                <li key={k} className="flex justify-between gap-2"><Link href={`/coaching/clients/${w.clientId}?tab=membership`} className="truncate hover:text-orange-600">{w.name}</Link><span className="shrink-0 text-gray-500">{dm(w.date)} · {soles(w.amount)}</span></li>
              ))}
            </ul>
          </details>
        )}

        {data.recent.length > 0 && (
          <details className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-700">Registrado en los últimos 3 días · {data.recent.length}</summary>
            <ul className="mt-2 space-y-1 text-xs text-gray-600">
              {data.recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{dm(r.at)} · {r.name} · {r.outcome === "PROMISED" ? "prometió pagar" : r.outcome === "DISMISSED" ? "no escribirle" : "se le escribió"}{r.kind === "BALANCE" ? " (saldo)" : ""}</span>
                  <button className="shrink-0 text-gray-400 underline" onClick={() => post({ action: "undo", id: r.id }, "Deshecho")}>deshacer</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {promise && <PromiseModal item={promise} today={data.today} onClose={() => setPromise(null)} onSave={(d) => record(promise, "PROMISED", "Volverá a aparecer ese día", d).then((ok) => ok && setPromise(null))} />}
      {phones && (
        <Modal open onClose={() => { setPhones(false); load() }} title={`Celulares por completar · ${data.noPhone.length}`}>
          <p className="mb-3 text-xs text-gray-500">Escribe el celular y pasa al siguiente: se guarda solo. Para otro país, empieza con + y el código.</p>
          <ul className="space-y-2">
            {data.noPhone.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-gray-800">{c.name}</span>
                <PhoneInput clientId={c.id} initial={c.phone} />
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {messages && <MessagesModal templates={data.templates} onClose={() => { setMessages(false); load() }} />}
    </main>
  )
}

/** Casilla de celular que se guarda sola al salir (o con Enter). */
function PhoneInput({ clientId, initial, compact, onSaved }: { clientId: string; initial: string; compact?: boolean; onSaved?: () => void }) {
  const [value, setValue] = useState(initial)
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  async function save() {
    if (!value.trim() || value === initial || state === "saving" || state === "saved") return
    setState("saving")
    try {
      const r = await api<{ phone: string }>(URL_, "POST", { action: "setPhone", clientId, phone: value })
      setValue(r.phone)
      setState("saved")
      onSaved?.()
    } catch (e) {
      setState("error")
      toast.error((e as Error).message)
    }
  }
  return (
    <span className="flex shrink-0 items-center gap-1">
      <input
        type="tel"
        inputMode="tel"
        value={value}
        onChange={(e) => { setValue(e.target.value); setState("idle") }}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder={compact ? "Agregar celular" : "987654321"}
        aria-label="Celular"
        className={cn("w-36 rounded-lg border px-2 py-1.5 text-sm", state === "error" ? "border-red-400" : state === "saved" ? "border-emerald-400" : "border-gray-300")}
      />
      <span className="w-4 text-xs">{state === "saved" ? "✓" : state === "saving" ? "…" : ""}</span>
    </span>
  )
}

function PromiseModal({ item, today, onClose, onSave }: { item: CollectionItem; today: string; onClose: () => void; onSave: (ymd: string) => void }) {
  const [date, setDate] = useState("")
  return (
    <Modal open onClose={onClose} title={`${item.name}: ¿cuándo prometió pagar?`}>
      <div className="space-y-3">
        <Field label="Fecha" hint="Ese día vuelve a aparecer en Cobranza.">
          <Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} autoFocus />
        </Field>
        <div className="flex justify-end gap-2">
          <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
          <Btn disabled={!date || date <= today} onClick={() => onSave(date)}>Guardar</Btn>
        </div>
      </div>
    </Modal>
  )
}

function MessagesModal({ templates, onClose }: { templates: Data["templates"]; onClose: () => void }) {
  const [texts, setTexts] = useState(() => Object.fromEntries(templates.map((t) => [t.key, t.text])))
  const [saved, setSaved] = useState<string | null>(null)
  async function save(key: string, text: string) {
    try {
      await api(URL_, "POST", { action: "setTemplate", key, text })
      setSaved(key)
      toast.success(text ? "Mensaje guardado" : "Volvió al mensaje original")
      if (!text) onClose()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  return (
    <Modal open onClose={onClose} title="Mensajes de WhatsApp" wide>
      <p className="mb-3 text-xs text-gray-500">
        Puedes usar <b>{"{nombre}"}</b>, <b>{"{plan}"}</b>, <b>{"{fecha}"}</b> y <b>{"{monto}"}</b>; se reemplazan solos. El monto no sale si no lo escribes.
      </p>
      <div className="space-y-4">
        {templates.map((t) => (
          <div key={t.key} className="space-y-1">
            <Field label={t.label}>
              <Textarea value={texts[t.key]} maxLength={600} onChange={(e) => { setSaved(null); setTexts((s) => ({ ...s, [t.key]: e.target.value })) }} />
            </Field>
            <div className="flex justify-end gap-2">
              {t.edited && <Btn size="sm" variant="ghost" onClick={() => save(t.key, "")}>Volver al original</Btn>}
              <Btn size="sm" variant="outline" disabled={texts[t.key] === t.text || !texts[t.key].trim() || saved === t.key} onClick={() => save(t.key, texts[t.key])}>{saved === t.key ? "Guardado ✓" : "Guardar"}</Btn>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
