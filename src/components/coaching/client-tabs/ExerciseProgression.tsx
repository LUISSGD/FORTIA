"use client"

import { useState } from "react"
import LineChartCard from "@/components/coaching/LineChartCard"
import { Select } from "@/components/coaching/kit"
import { estimate1RM, formatSet } from "@/lib/coaching/workout"

type Data = { exerciseId: string; name: string; sessions: { date: string; sets: { weight: number | null; reps: number | null }[] }[] }[]

export default function ExerciseProgression({ data }: { data: Data }) {
  const [id, setId] = useState(data[0]?.exerciseId ?? "")
  const [metric, setMetric] = useState<"e1rm" | "top" | "volume">("e1rm")
  if (!data.length) return <p className="text-sm text-gray-500">Cuando el cliente registre entrenamientos verás aquí su progresión.</p>
  const ex = data.find((d) => d.exerciseId === id) ?? data[0]
  const points = ex.sessions.map((s) => {
    const e1rm = Math.max(...s.sets.map((x) => estimate1RM(x.weight ?? 0, x.reps ?? 0)))
    const top = Math.max(...s.sets.map((x) => x.weight ?? 0))
    const volume = s.sets.reduce((a, x) => a + (x.weight ?? 0) * (x.reps ?? 0), 0)
    const [, m, d] = s.date.split("-")
    return { label: `${d}/${m}`, value: Math.round((metric === "e1rm" ? e1rm : metric === "top" ? top : volume) * 10) / 10 }
  })
  const first = points[0]?.value ?? 0
  const last = points.at(-1)?.value ?? 0
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={ex.exerciseId} onChange={(e) => setId(e.target.value)} className="flex-1 min-w-48">
          {data.map((d) => <option key={d.exerciseId} value={d.exerciseId}>{d.name} ({d.sessions.length})</option>)}
        </Select>
        <Select value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)} className="w-44">
          <option value="e1rm">1RM estimado</option>
          <option value="top">Peso máximo</option>
          <option value="volume">Volumen (kg)</option>
        </Select>
      </div>
      {points.length >= 2 && (
        <p className={`text-sm font-semibold ${last >= first ? "text-emerald-600" : "text-red-600"}`}>
          {last >= first ? "📈" : "📉"} {first} → {last} ({last - first >= 0 ? "+" : ""}{Math.round((last - first) * 10) / 10}) {metric === "volume" ? "kg vol." : "kg"}
        </p>
      )}
      <LineChartCard data={points} unit="kg" />
      <div className="max-h-60 overflow-y-auto">
        <table className="w-full text-xs">
          <tbody className="divide-y divide-gray-100">
            {[...ex.sessions].reverse().map((s, i) => (
              <tr key={i}>
                <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">Sesión {ex.sessions.length - i} · {s.date.split("-").reverse().join("/")}</td>
                <td className="py-1.5">{s.sets.map(formatSet).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
