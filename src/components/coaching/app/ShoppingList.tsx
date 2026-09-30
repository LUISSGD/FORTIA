"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export default function ShoppingList({ groups }: { groups: { label: string; items: { name: string; qty: string }[] }[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try { setChecked(JSON.parse(localStorage.getItem("fortia-shopping") ?? "{}")) } catch {}
  }, [])
  const toggle = (k: string) => setChecked((c) => {
    const next = { ...c, [k]: !c[k] }
    try { localStorage.setItem("fortia-shopping", JSON.stringify(next)) } catch {}
    return next
  })
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mb-2">{g.label}</p>
          <div className="rounded-2xl bg-white border border-gray-100 divide-y divide-gray-100">
            {g.items.map((i) => (
              <button key={i.name} onClick={() => toggle(i.name)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                <span className={cn("h-5 w-5 rounded-md border-2 flex items-center justify-center text-xs", checked[i.name] ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300")}>{checked[i.name] && "✓"}</span>
                <span className={cn("flex-1 text-sm text-gray-900", checked[i.name] && "line-through text-gray-400")}>{i.name}</span>
                <span className="text-xs text-gray-400">{i.qty}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => { setChecked({}); try { localStorage.removeItem("fortia-shopping") } catch {} }} className="w-full text-xs text-gray-400 py-2">Desmarcar todo</button>
    </div>
  )
}
