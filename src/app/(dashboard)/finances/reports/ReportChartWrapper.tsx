"use client"

import { useEffect, useState } from "react"
import ReportChart from "@/components/finances/ReportChart"
import { formatCurrency } from "@/lib/utils"

interface DataPoint {
  month: string
  ingresos: number
  egresos: number
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

  const totalIncome = data.reduce((s, d) => s + d.ingresos, 0)
  const totalExpenses = data.reduce((s, d) => s + d.egresos, 0)

  if (loading) return <div className="h-64 animate-pulse bg-gray-100 rounded" />

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <p className="text-sm text-gray-500">Total ingresos (6 meses)</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">Total egresos (6 meses)</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">Neto acumulado</p>
          <p className={`text-xl font-bold ${totalIncome - totalExpenses >= 0 ? "text-blue-600" : "text-orange-600"}`}>
            {formatCurrency(totalIncome - totalExpenses)}
          </p>
        </div>
      </div>
      <ReportChart data={data} />
    </div>
  )
}
