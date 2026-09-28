"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"

type Photo = { id: string; date: string; pose: string; url: string }

const POSES = [["FRENTE", "Frente"], ["PERFIL", "Perfil"], ["ESPALDA", "Espalda"]] as const
const fmt = (d: string) => d.split("-").reverse().join("/")

/** Galería de fotos por fecha con comparación lado a lado (antes / después). */
export default function PhotoCompare({ photos, dark = false, onDelete }: { photos: Photo[]; dark?: boolean; onDelete?: (id: string) => void }) {
  const dates = useMemo(() => [...new Set(photos.map((p) => p.date))].sort(), [photos])
  const [pose, setPose] = useState<string>("FRENTE")
  const [a, setA] = useState(dates[0] ?? "")
  const [b, setB] = useState(dates.at(-1) ?? "")

  if (!photos.length) return <p className={cn("text-sm text-center py-6", dark ? "text-zinc-500" : "text-gray-500")}>Aún no hay fotos de progreso.</p>

  const pick = (date: string) => photos.find((p) => p.date === date && p.pose === pose)
  const selectCls = cn("h-8 rounded-lg px-2 text-xs border", dark ? "bg-zinc-900 border-zinc-700 text-white" : "bg-white border-gray-300")

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {POSES.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setPose(k)} className={cn("px-3 py-1 rounded-full text-xs font-medium", pose === k ? "bg-orange-500 text-white" : dark ? "bg-zinc-800 text-zinc-300" : "bg-gray-100 text-gray-600")}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[[a, setA], [b, setB]].map(([val, setter], i) => {
          const photo = pick(val as string)
          return (
            <div key={i} className="space-y-1">
              <select value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} className={cn(selectCls, "w-full")}>
                {dates.map((d) => <option key={d} value={d}>{fmt(d)}</option>)}
              </select>
              <div className={cn("aspect-[3/4] rounded-xl overflow-hidden flex items-center justify-center", dark ? "bg-zinc-900" : "bg-gray-100")}>
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt={`${pose} ${val}`} className="w-full h-full object-cover" />
                ) : (
                  <span className={cn("text-xs", dark ? "text-zinc-600" : "text-gray-400")}>Sin foto</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <details>
        <summary className={cn("text-xs cursor-pointer", dark ? "text-zinc-400" : "text-gray-500")}>Ver todas ({photos.length})</summary>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="" className="aspect-[3/4] w-full object-cover rounded-lg" /></a>
              <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white rounded px-1">{fmt(p.date)} · {p.pose.toLowerCase()}</span>
              {onDelete && (
                <button type="button" onClick={() => onDelete(p.id)} className="absolute top-1 right-1 text-[10px] bg-black/60 text-white rounded px-1.5">✕</button>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
