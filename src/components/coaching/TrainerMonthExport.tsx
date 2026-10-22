"use client"

import { toast } from "sonner"
import { Download } from "lucide-react"
import type { MonthClass, TrainerTotals } from "@/lib/coaching/trainer-month"

const STATE: Record<MonthClass["state"], string> = { given: "Dada", noShow: "No asistió", unmarked: "Sin marcar", upcoming: "Por dar" }

/** Descarga las clases del mes en Excel: resumen por entrenador + detalle de cada clase. */
export default function TrainerMonthExport({ label, trainer, rows, totals }: { label: string; trainer: string | null; rows: MonthClass[]; totals: TrainerTotals[] }) {
  async function run() {
    const { default: ExcelJS } = await import("exceljs")
    const wb = new ExcelJS.Workbook()
    const sum = wb.addWorksheet("Resumen")
    sum.addRow([`Clases del mes · ${label}${trainer ? ` · ${trainer}` : ""}`]).font = { bold: true, size: 13 }
    sum.addRow([])
    sum.addRow(["Entrenador", "Dadas", "No asistió", "Sin marcar", "Por dar", "Pruebas dadas"]).font = { bold: true }
    totals.forEach((t) => sum.addRow([t.trainer, t.given, t.noShow, t.unmarked, t.upcoming, t.trialsGiven]))
    sum.getColumn(1).width = 18
    const det = wb.addWorksheet("Detalle")
    det.addRow(["Fecha", "Hora", "Entrenador", "Cliente", "Plan", "Clase", "Tipo", "Estado"]).font = { bold: true }
    rows.forEach((c) => det.addRow([c.date.split("-").reverse().join("/"), c.time ?? "", c.trainer, c.client, c.plan, c.number ?? "", c.kind === "trial" ? "Prueba" : "Personalizada", STATE[c.state]]))
    ;[11, 7, 14, 30, 48, 9, 13, 12].forEach((w, i) => (det.getColumn(i + 1).width = w))
    const buf = await wb.xlsx.writeBuffer()
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
    a.download = `Clases ${label}${trainer ? ` ${trainer}` : ""}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <button onClick={() => run().catch(() => toast.error("No se pudo generar el Excel"))} className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
      <Download className="h-3.5 w-3.5" /> Excel
    </button>
  )
}
