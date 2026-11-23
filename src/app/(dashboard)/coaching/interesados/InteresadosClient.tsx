"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Btn, Field, Input, Modal, Select, Textarea, api } from "@/components/coaching/kit"
import { TrialModals, type TrialLead } from "@/components/coaching/trials/TrialModals"
import { LEAD_SOURCES, LEAD_STAGES, LOST_REASONS, SOURCE_LABEL, STAGE_LABEL, type LeadStage } from "@/lib/coaching/lead-rules"
import type { LeadRow } from "@/lib/coaching/leads"

// Embudo de interesados: columnas en la computadora, pestañas en el celular.

type Data = { today: string; leads: LeadRow[] }
const URL_ = "/api/coaching/leads"
const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`
const fullName = (l: Pick<LeadRow, "firstName" | "lastName">) => [l.firstName, l.lastName].filter(Boolean).join(" ")
const TONE: Record<LeadStage, string> = { NEW: "bg-sky-100 text-sky-800", CONTACTED: "bg-amber-100 text-amber-800", TRIAL: "bg-violet-100 text-violet-800", WON: "bg-emerald-100 text-emerald-800", LOST: "bg-gray-100 text-gray-600" }
const TRIAL_LABEL: Record<string, string> = { SCHEDULED: "Prueba", ATTENDED: "✅ Vino", NO_SHOW: "❌ No vino", CANCELLED: "Prueba cancelada" }

export default function InteresadosClient() {
  const router = useRouter()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<LeadStage>("NEW")
  const [open, setOpen] = useState<string | null>(null)
  const [form, setForm] = useState<LeadRow | "new" | null>(null)
  const [trialFor, setTrialFor] = useState<{ lead: TrialLead } | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await api<Data>(URL_))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const byStage = useMemo(() => {
    const m = Object.fromEntries(LEAD_STAGES.map((s) => [s, [] as LeadRow[]])) as Record<LeadStage, LeadRow[]>
    for (const l of data?.leads ?? []) m[l.stage]?.push(l)
    // Primero los que necesitan atención
    for (const s of LEAD_STAGES) m[s].sort((a, b) => Number(!!b.alert) - Number(!!a.alert) || b.createdAt.localeCompare(a.createdAt))
    return m
  }, [data])

  if (error) return <main className="p-6 text-sm text-red-600">{error} <button className="underline" onClick={load}>Reintentar</button></main>
  if (!data) return <main className="p-6 text-sm text-gray-500">Cargando…</main>

  const closed = byStage.WON.length + byStage.LOST.length
  const alerts = data.leads.filter((l) => l.alert).length
  const sources = LEAD_SOURCES.map((s) => ({ s, n: data.leads.filter((l) => l.source === s).length })).filter((x) => x.n).sort((a, b) => b.n - a.n)
  const current = open ? data.leads.find((l) => l.id === open) ?? null : null

  async function patch(id: string, body: object, ok: string) {
    try {
      await api(`${URL_}/${id}`, "PATCH", body)
      toast.success(ok)
      await load()
      return true
    } catch (e) {
      toast.error((e as Error).message)
      return false
    }
  }

  async function convert(l: LeadRow, extra: object = {}) {
    const res = await fetch(`${URL_}/${l.id}/convert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(extra) })
    const r = await res.json().catch(() => ({}))
    if (res.status === 409 && r.existing) {
      if (confirm(`Ya existe un cliente con ese celular: ${r.existing.name}.\n\nAceptar = enlazar a ese cliente.\nCancelar = no hacer nada.`)) return convert(l, { linkClientId: r.existing.id })
      return
    }
    if (!res.ok) return toast.error(r.error ?? "No se pudo convertir")
    toast.success(`${l.firstName} ya es alumno de FORTIA 🎉`)
    router.push(`/coaching/clients/${r.clientId}?tab=membership`)
  }

  const card = (l: LeadRow) => (
    <button key={l.id} onClick={() => setOpen(l.id)} className={cn("w-full rounded-xl border bg-white p-3 text-left hover:border-gray-400", l.alert ? "border-red-300" : "border-gray-200")}>
      <p className="truncate text-sm font-semibold text-gray-900">{fullName(l)}</p>
      <p className="truncate text-xs text-gray-500">{l.goal ?? "Sin objetivo"}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{SOURCE_LABEL[l.source]}{l.referredBy ? ` · ${l.referredBy}` : ""}</span>
        <span className="text-gray-400">{dm(l.createdAt)}</span>
        {l.trial && l.stage === "TRIAL" && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700">{TRIAL_LABEL[l.trial.status]} {dm(l.trial.date)} {l.trial.startTime}</span>}
        {l.nextContactOn && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">📅 {dm(l.nextContactOn)}</span>}
      </div>
      {l.alert && <p className="mt-1 text-[11px] font-semibold text-red-600">⚠️ {l.alert}</p>}
      {l.stage === "LOST" && l.lostReason && <p className="mt-1 text-[11px] text-gray-500">{l.lostReason}</p>}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Interesados</h1>
          <p className="text-sm text-gray-500">
            {data.leads.length - closed} abiertos{alerts > 0 && <> · <b className="text-red-600">{alerts} por atender</b></>}
            {closed > 0 && <> · <b className="text-gray-800">{Math.round((byStage.WON.length / closed) * 100)} %</b> se hizo alumno (últimos 90 días)</>}
          </p>
          {sources.length > 0 && <p className="text-xs text-gray-400">Llegan por: {sources.map((x) => `${SOURCE_LABEL[x.s]} ${x.n}`).join(" · ")}</p>}
        </div>
        <Btn size="sm" onClick={() => setForm("new")}><Plus className="h-3.5 w-3.5" /> Interesado</Btn>
      </div>

      {data.leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          Aún no tienes interesados. Agrega al primero que te escriba por Instagram o WhatsApp.
        </div>
      ) : (
        <>
          {/* Celular: pestañas */}
          <div className="md:hidden space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {LEAD_STAGES.map((s) => (
                <button key={s} onClick={() => setTab(s)} className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-medium", tab === s ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-600")}>
                  {STAGE_LABEL[s]} <b>{byStage[s].length}</b>{byStage[s].some((l) => l.alert) && <span className="ml-1 text-red-500">●</span>}
                </button>
              ))}
            </div>
            <div className="space-y-2">{byStage[tab].length ? byStage[tab].map(card) : <p className="py-6 text-center text-sm text-gray-400">Nadie en esta etapa.</p>}</div>
          </div>
          {/* Computadora: columnas */}
          <div className="hidden md:grid grid-cols-5 gap-3 items-start">
            {LEAD_STAGES.map((s) => (
              <div key={s} className="rounded-xl bg-gray-50 p-2 space-y-2 min-w-0">
                <p className="flex items-center justify-between px-1"><span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", TONE[s])}>{STAGE_LABEL[s]}</span><span className="text-xs text-gray-400">{byStage[s].length}</span></p>
                {byStage[s].map(card)}
              </div>
            ))}
          </div>
        </>
      )}

      {current && !form && !trialFor && (
        <LeadModal
          key={current.id}
          lead={current}
          onClose={() => setOpen(null)}
          onPatch={(b, ok) => patch(current.id, b, ok)}
          onEdit={() => setForm(current)}
          onTrial={() => setTrialFor({ lead: current })}
          onConvert={() => convert(current)}
          onDelete={async () => {
            if (!confirm(`¿Borrar los datos de ${fullName(current)}? No se puede deshacer.`)) return
            try {
              await api(`${URL_}/${current.id}`, "DELETE")
              toast.success("Datos borrados")
              setOpen(null)
              load()
            } catch (e) {
              toast.error((e as Error).message)
            }
          }}
        />
      )}
      {form && <LeadForm lead={form === "new" ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); load() }} />}
      <TrialModals form={trialFor} onCloseForm={() => setTrialFor(null)} detail={null} onCloseDetail={() => {}} onEdit={() => {}} canConvert={false} onSaved={load} />
    </div>
  )
}

function LeadModal({ lead: l, onClose, onPatch, onEdit, onTrial, onConvert, onDelete }: {
  lead: LeadRow
  onClose: () => void
  onPatch: (body: object, ok: string) => Promise<boolean>
  onEdit: () => void
  onTrial: () => void
  onConvert: () => void
  onDelete: () => void
}) {
  const [asking, setAsking] = useState(false)
  const [losing, setLosing] = useState(false)
  const isOpen = l.stage !== "WON" && l.stage !== "LOST"
  return (
    <Modal open onClose={onClose} title={fullName(l)}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn("rounded-full px-2 py-0.5 font-semibold", TONE[l.stage])}>{STAGE_LABEL[l.stage]}</span>
          <span className="text-gray-500">{SOURCE_LABEL[l.source]}{l.referredBy ? `, lo recomendó ${l.referredBy}` : ""} · llegó el {dm(l.createdAt)}</span>
        </div>
        {l.alert && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">⚠️ {l.alert}</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          {l.phone && <><dt className="text-gray-500">Celular</dt><dd>{l.phone}</dd></>}
          {l.email && <><dt className="text-gray-500">Correo</dt><dd className="truncate">{l.email}</dd></>}
          {l.goal && <><dt className="text-gray-500">Objetivo</dt><dd>{l.goal}</dd></>}
          {l.daysPerWeek && <><dt className="text-gray-500">Puede entrenar</dt><dd>{l.daysPerWeek} días por semana</dd></>}
          {l.planInterest && <><dt className="text-gray-500">Le interesa</dt><dd>{l.planInterest}</dd></>}
          {l.trial && <><dt className="text-gray-500">Clase de prueba</dt><dd>{dm(l.trial.date)} {l.trial.startTime} · {TRIAL_LABEL[l.trial.status]}</dd></>}
          {l.contactedAt && <><dt className="text-gray-500">Le escribiste</dt><dd>{dm(l.contactedAt)}</dd></>}
          {l.lostReason && <><dt className="text-gray-500">Motivo</dt><dd>{l.lostReason}</dd></>}
          {l.notes && <><dt className="text-gray-500">Notas</dt><dd className="whitespace-pre-wrap">{l.notes}</dd></>}
        </dl>

        {isOpen && (
          asking ? (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm">
              <span className="font-medium text-emerald-900">¿Le enviaste el mensaje?</span>
              <span className="flex gap-2">
                <Btn size="sm" onClick={() => onPatch({ contacted: true }, "Registrado ✓").then(() => setAsking(false))}>Sí</Btn>
                <Btn size="sm" variant="outline" onClick={() => setAsking(false)}>No</Btn>
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {l.waUrl ? (
                <a href={l.waUrl} target="_blank" rel="noreferrer" onClick={() => setAsking(true)} className="col-span-2 flex h-10 items-center justify-center rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700">WhatsApp</a>
              ) : (
                <Btn variant="outline" className="col-span-2" onClick={onEdit}>Agregar celular</Btn>
              )}
              <Btn variant="outline" onClick={() => onPatch({ contacted: true }, "Registrado ✓")}>Ya le escribí</Btn>
              <Btn variant="outline" onClick={onTrial}>{l.trial && l.trial.status !== "CANCELLED" ? "Nueva clase de prueba" : "Agendar clase de prueba"}</Btn>
              <Btn className="col-span-2" onClick={onConvert}>Convertir en alumno</Btn>
            </div>
          )
        )}

        {isOpen && (
          <Field label="Próximo contacto" hint="Ese día te avisa que toca escribirle.">
            <Input type="date" value={l.nextContactOn ?? ""} onChange={(e) => onPatch({ nextContactOn: e.target.value || null }, "Próximo contacto guardado")} />
          </Field>
        )}

        {losing && (
          <div className="space-y-2 rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-600">¿Por qué no siguió?</p>
            <div className="flex flex-wrap gap-1.5">
              {LOST_REASONS.map((r) => <Btn key={r} size="sm" variant="outline" onClick={() => onPatch({ stage: "LOST", lostReason: r }, "Marcado como perdido").then(() => setLosing(false))}>{r}</Btn>)}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          <Btn size="sm" variant="ghost" onClick={onEdit}>Editar</Btn>
          {isOpen && <Btn size="sm" variant="ghost" onClick={() => setLosing((v) => !v)}>Perdido</Btn>}
          {l.stage === "LOST" && <Btn size="sm" variant="outline" onClick={() => onPatch({ stage: "CONTACTED" }, "Volvió a Contactado")}>Retomar</Btn>}
          {l.clientId && <a href={`/coaching/clients/${l.clientId}`}><Btn size="sm" variant="outline">Ver su ficha →</Btn></a>}
          <Btn size="sm" variant="danger" className="ml-auto" onClick={onDelete}>Borrar datos</Btn>
        </div>
      </div>
    </Modal>
  )
}

function LeadForm({ lead, onClose, onSaved }: { lead: LeadRow | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    firstName: lead?.firstName ?? "", lastName: lead?.lastName ?? "", phone: lead?.phone ?? "", email: lead?.email ?? "", goal: lead?.goal ?? "",
    daysPerWeek: lead?.daysPerWeek ? String(lead.daysPerWeek) : "", planInterest: lead?.planInterest ?? "", source: lead?.source ?? "INSTAGRAM", referredBy: lead?.referredBy ?? "", notes: lead?.notes ?? "",
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))
  async function save() {
    setSaving(true)
    try {
      if (lead) await api(`${URL_}/${lead.id}`, "PATCH", f)
      else await api(URL_, "POST", f)
      toast.success(lead ? "Guardado" : "Interesado agregado 🎯")
      onSaved()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal open onClose={onClose} title={lead ? "Editar interesado" : "Nuevo interesado"}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre *"><Input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} autoFocus /></Field>
          <Field label="Apellidos"><Input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
          <Field label="Celular"><Input type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="987654321" /></Field>
          <Field label="Correo"><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="¿Cómo llegó?">
            <Select value={f.source} onChange={(e) => set("source", e.target.value)}>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}</Select>
          </Field>
          <Field label="¿Quién lo recomendó?"><Input value={f.referredBy} onChange={(e) => set("referredBy", e.target.value)} /></Field>
          <Field label="Días por semana">
            <Select value={f.daysPerWeek} onChange={(e) => set("daysPerWeek", e.target.value)}><option value="">—</option>{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{d}</option>)}</Select>
          </Field>
          <Field label="Plan que le interesa"><Input value={f.planInterest} onChange={(e) => set("planInterest", e.target.value)} placeholder="Fortia X, Elite…" /></Field>
        </div>
        <Field label="Objetivo"><Input value={f.goal} onChange={(e) => set("goal", e.target.value)} placeholder="Bajar de peso, ganar fuerza…" /></Field>
        <Field label="Notas"><Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <Btn className="w-full" disabled={saving || !f.firstName.trim()} onClick={save}>{saving ? "Guardando…" : "Guardar"}</Btn>
      </div>
    </Modal>
  )
}
