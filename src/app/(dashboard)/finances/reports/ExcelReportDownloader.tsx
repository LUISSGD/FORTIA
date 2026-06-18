"use client"

import { useState } from "react"
import { FileSpreadsheet, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function getDefaultDates() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const to = now.toISOString().split("T")[0]
  return { from, to }
}

const PRESETS = [
  { label: "Este mes", getDates: () => getDefaultDates() },
  {
    label: "Mes anterior",
    getDates: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0]
      const to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0]
      return { from, to }
    },
  },
  {
    label: "Últimos 3 meses",
    getDates: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split("T")[0]
      const to = now.toISOString().split("T")[0]
      return { from, to }
    },
  },
  {
    label: "Este año",
    getDates: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0]
      const to = now.toISOString().split("T")[0]
      return { from, to }
    },
  },
]

export default function ExcelReportDownloader() {
  const defaults = getDefaultDates()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    if (!from || !to) { toast.error("Selecciona un rango de fechas"); return }
    if (from > to) { toast.error("La fecha de inicio no puede ser mayor al fin"); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/reports/excel?from=${from}&to=${to}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `reporte-fortia-${from}-${to}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Reporte descargado")
    } catch {
      toast.error("Error al generar el reporte")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-5 w-5 text-green-600" />
          Exportar reporte Excel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 mb-4">
          Genera un archivo Excel con ingresos, egresos y nuevos clientes del período seleccionado.
        </p>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => { const d = p.getDates(); setFrom(d.from); setTo(d.to) }}
              className="px-3 py-1 text-xs rounded-full border border-orange-300 text-orange-600 hover:bg-orange-50 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <Button
            onClick={handleDownload}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="h-4 w-4 mr-2" />
            {loading ? "Generando..." : "Descargar Excel"}
          </Button>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          El archivo incluye 4 hojas: Resumen, Ingresos, Egresos y Nuevos Clientes.
        </p>
      </CardContent>
    </Card>
  )
}
