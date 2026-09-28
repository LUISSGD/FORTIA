"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { Btn, Panel } from "@/components/coaching/kit"

type Report = { created: number; updated: number; skipped: number; errors: { row: number; message: string }[]; notes: string[]; rows: number; recognized: string[]; ignored: string[]; dryRun: boolean }

const STEPS = [
  { kind: "clients", n: 1, title: "👥 Clientes", desc: "Nombre, apellido, email, teléfono, nacimiento, sexo, altura, objetivo, nivel, días de entreno, precio. Si el cliente ya existe (por email o nombre) se actualiza; si no, se crea y queda en coaching." },
  { kind: "measurements", n: 2, title: "📏 Medidas", desc: "Una fila por fecha y cliente: peso, % grasa, pecho, cintura, cadera, brazo, pierna. Si ya hay un registro ese día, se actualiza." },
  { kind: "routines", n: 3, title: "🏋️ Rutinas", desc: "Una fila por ejercicio: programa, día, orden, ejercicio, series, reps, descanso, RIR, tempo, carga. Sin email/nombre → se crea como plantilla. Los ejercicios que no estén en tu biblioteca se crean." },
] as const

const LABELS: Record<string, string> = {
  firstName: "Nombre", lastName: "Apellido", fullName: "Nombre completo", email: "Email", phone: "Teléfono", birthDate: "Nacimiento", sex: "Sexo", height: "Altura", goal: "Objetivo",
  level: "Nivel", trainingDays: "Días entreno", price: "Precio", startDate: "Inicio", notes: "Notas", date: "Fecha", weight: "Peso", bodyFat: "% grasa", chest: "Pecho", waist: "Cintura",
  hips: "Cadera", arms: "Brazo", legs: "Pierna", program: "Programa", day: "Día", exercise: "Ejercicio", order: "Orden", sets: "Series", reps: "Reps", rest: "Descanso", rir: "RIR",
  tempo: "Tempo", load: "Carga", exerciseNotes: "Notas ejercicio",
}

function Step({ kind, n, title, desc }: (typeof STEPS)[number]) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)

  async function send(dryRun: boolean) {
    if (!file) return
    setBusy(true)
    const fd = new FormData()
    fd.append("file", file)
    if (dryRun) fd.append("dryRun", "1")
    const res = await fetch(`/api/coaching/import/${kind}`, { method: "POST", body: fd })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) return toast.error(data.error ?? "Error al importar")
    setReport(data)
    if (!dryRun) {
      toast.success(`Importación completa: ${data.created} nuevos, ${data.updated} actualizados`)
      router.refresh()
    }
  }

  return (
    <Panel title={<span><span className="text-orange-500 mr-1">Paso {n}.</span> {title}</span>} action={<a href={`/api/coaching/import/${kind}`} className="text-xs text-orange-600 flex items-center gap-1"><Download className="h-3.5 w-3.5" /> Plantilla</a>}>
      <p className="text-xs text-gray-500 mb-3">{desc}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm border border-dashed border-gray-300 rounded-lg px-3 h-9 cursor-pointer hover:border-orange-400">
          <FileSpreadsheet className="h-4 w-4 text-gray-400" />
          <span className="truncate max-w-56">{file?.name ?? "Elegir .xlsx o .csv"}</span>
          <input type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); e.target.value = "" }} />
        </label>
        <Btn variant="outline" disabled={!file || busy} onClick={() => send(true)}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Vista previa</Btn>
        <Btn disabled={!file || busy || !report?.dryRun} onClick={() => { if (confirm("¿Importar ahora? Se guardarán los cambios en la base de datos.")) send(false) }}>Importar</Btn>
      </div>

      {report && (
        <div className={`mt-3 rounded-lg p-3 text-sm space-y-2 ${report.dryRun ? "bg-gray-50" : "bg-emerald-50"}`}>
          <p className="font-semibold">
            {report.dryRun ? "Vista previa" : "✅ Importado"} · {report.rows} filas → {report.created} {report.dryRun ? "a crear" : "creados"}, {report.updated} {report.dryRun ? "a actualizar" : "actualizados"}
            {report.skipped ? `, ${report.skipped} omitidas` : ""}{report.errors.length ? `, ${report.errors.length} con error` : ""}
          </p>
          <p className="text-xs text-gray-600">Columnas reconocidas: {report.recognized.map((k) => LABELS[k] ?? k).join(", ") || "ninguna"}</p>
          {report.ignored.length > 0 && <p className="text-xs text-gray-400">Columnas ignoradas: {report.ignored.join(", ")}</p>}
          {report.notes.map((t, i) => <p key={i} className="text-xs text-amber-700">⚠️ {t}</p>)}
          {report.errors.length > 0 && (
            <ul className="text-xs text-red-600 max-h-40 overflow-y-auto">
              {report.errors.slice(0, 50).map((e, i) => <li key={i}>Fila {e.row}: {e.message}</li>)}
            </ul>
          )}
        </div>
      )}
    </Panel>
  )
}

export default function ImportClient() {
  return (
    <div className="space-y-4">
      {STEPS.map((s) => <Step key={s.kind} {...s} />)}
      <Panel title="¿Cómo exportar desde Harbiz?">
        <ol className="text-sm text-gray-600 list-decimal pl-5 space-y-1">
          <li>En Harbiz, busca en Clientes la opción de exportar (Excel/CSV). Si no aparece, pide a su soporte la exportación de tus datos: tienes derecho a ellos.</li>
          <li>Para medidas y rutinas, si Harbiz no las exporta, puedes copiar los datos a la plantilla de cada paso (botón “Plantilla”).</li>
          <li>Importa en orden: clientes → medidas → rutinas. Revisa la vista previa antes de confirmar.</li>
          <li>Después crea el acceso a la app de cada cliente desde su perfil → Ajustes.</li>
        </ol>
      </Panel>
    </div>
  )
}
