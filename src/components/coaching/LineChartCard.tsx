"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export type ChartPoint = { label: string; value: number | null }

export default function LineChartCard({
  data,
  unit = "",
  color = "#f97316",
  height = 200,
  dark = false,
}: {
  data: ChartPoint[]
  unit?: string
  color?: string
  height?: number
  dark?: boolean
}) {
  const values = data.map((d) => d.value).filter((v): v is number => v !== null)
  if (values.length < 2) {
    return <p className={`text-sm text-center py-8 ${dark ? "text-zinc-500" : "text-gray-400"}`}>Se necesitan al menos 2 registros para el gráfico.</p>
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max(1, (max - min) * 0.15)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#27272a" : "#f0f0f0"} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: dark ? "#a1a1aa" : "#6b7280" }} tickLine={false} axisLine={false} />
        <YAxis
          domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
          tick={{ fontSize: 11, fill: dark ? "#a1a1aa" : "#6b7280" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(v) => [`${v} ${unit}`.trim(), ""]}
          contentStyle={dark ? { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" } : { borderRadius: 8 }}
        />
        <Line isAnimationActive={false} type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}
