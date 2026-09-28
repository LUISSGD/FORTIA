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
          <p className="text-xs font-bold tracking-widest uppercase text-zinc-400 mb-2">{g.label}</p>
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 divide-y divide-zinc-800">
            {g.items.map((i) => (
              <button key={i.name} onClick={() => toggle(i.name)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                <span className={cn("h-5 w-5 rounded-md border-2 flex items-center justify-center text-xs", checked[i.name] ? "bg-emerald-500 border-emerald-500" : "border-zinc-600")}>{checked[i.name] && "✓"}</span>
                <span className={cn("flex-1 text-sm", checked[i.name] && "line-through text-zinc-500")}>{i.name}</span>
                <span className="text-xs text-zinc-400">{i.qty}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => { setChecked({}); try { localStorage.removeItem("fortia-shopping") } catch {} }} className="w-full text-xs text-zinc-500 py-2">Desmarcar todo</button>
    </div>
  )
}
