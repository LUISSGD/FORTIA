"use client"

import { useEffect, useState } from "react"
import ReportChart from "@/components/finances/ReportChart"

interface DataPoint {
  month: string
  ingresos: number
  ingresosUSD: number
  egresos: number
  egresosUSD: number
  neto: number
}

export default function ReportChartWrapper() {
  const [data, setData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/finances/reports?months=6")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
  }, [])

  const totalPEN = data.reduce((s, d) => s + d.ingresos, 0)
  const totalUSD = data.reduce((s, d) => s + (d.ingresosUSD ?? 0), 0)
  const expPEN = data.reduce((s, d) => s + d.egresos, 0)
  const expUSD = data.reduce((s, d) => s + (d.egresosUSD ?? 0), 0)

  if (loading) return <div className="h-64 animate-pulse bg-gray-100 rounded" />

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <p className="text-xs text-gray-500">Ingresos S/ (6 meses)</p>
          <p className="text-lg font-bold text-green-600">S/ {totalPEN.toFixed(2)}</p>
          {totalUSD > 0 && <p className="text-sm font-semibold text-green-500">$ {totalUSD.toFixed(2)}</p>}
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Egresos S/ (6 meses)</p>
          <p className="text-lg font-bold text-red-600">S/ {expPEN.toFixed(2)}</p>
          {expUSD > 0 && <p className="text-sm font-semibold text-red-500">$ {expUSD.toFixed(2)}</p>}
        </div>
        <div className="text-center col-span-2 md:col-span-1">
          <p className="text-xs text-gray-500">Neto S/ acumulado</p>
          <p className={`text-lg font-bold ${(totalPEN - expPEN) >= 0 ? "text-blue-600" : "text-orange-600"}`}>
            S/ {(totalPEN - expPEN).toFixed(2)}
          </p>
          {(totalUSD > 0 || expUSD > 0) && (
            <p className={`text-sm font-semibold ${(totalUSD - expUSD) >= 0 ? "text-blue-500" : "text-orange-500"}`}>
              $ {(totalUSD - expUSD).toFixed(2)}
            </p>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-2">* El gráfico muestra únicamente montos en S/. Los dólares se muestran en los totales de arriba.</p>
      <ReportChart data={data} />
    </div>
  )
}
