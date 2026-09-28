"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Copy, Plus, Save, Search, Trash2, Users } from "lucide-react"
import { FOOD_CATEGORIES } from "@/lib/coaching/constants"
import { itemMacros, quantityLabel, roundMacros, sumMacros, type Macros } from "@/lib/coaching/nutrition"
import { cn } from "@/lib/utils"
import { Btn, Field, Input, Modal, Panel, Select, Textarea, api } from "@/components/coaching/kit"

type Food = { id: string; name: string; category: string; kcal: number; protein: number; carbs: number; fat: number; unitName: string | null; unitGrams: number | null }
type Item = { key: string; foodId: string | null; customName: string; grams: string; kcal: string; protein: string; carbs: string; fat: string }
type Option = { id?: string; key: string; label: string; notes: string; items: Item[] }
type Meal = { id?: string; key: string; name: string; time: string; options: Option[] }
type Targets = { calTarget: string; proteinTarget: string; carbsTarget: string; fatTarget: string }
type Plan = { id: string; name: string; description: string; isTemplate: boolean; isActive: boolean; client: { id: string; name: string } | null; clientTargets: Targets | null; targets: Targets; meals: Meal[] }

const uid = () => Math.random().toString(36).slice(2)
const letter = (i: number) => `Opción ${String.fromCharCode(65 + i)}`
function move<T>(arr: T[], i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const c = [...arr]
  ;[c[i], c[j]] = [c[j], c[i]]
  return c
}

export default function MealPlanBuilder({ plan, foods, clients }: { plan: Plan; foods: Food[]; clients: { id: string; name: string }[] }) {
  const router = useRouter()
  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])
  const [meta, setMeta] = useState({ name: plan.name, description: plan.description, isActive: plan.isActive, ...plan.targets })
  const [meals, setMeals] = useState<Meal[]>(plan.meals)
  const [activeOpt, setActiveOpt] = useState<Record<string, number>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [picker, setPicker] = useState<{ mi: number; oi: number } | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault() }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [dirty])

  const update = (fn: (m: Meal[]) => Meal[]) => { setMeals(fn); setDirty(true) }
  const updateMeal = (mi: number, patch: Partial<Meal>) => update((ms) => ms.map((m, i) => (i === mi ? { ...m, ...patch } : m)))
  const updateOption = (mi: number, oi: number, fn: (o: Option) => Option) => update((ms) => ms.map((m, i) => (i === mi ? { ...m, options: m.options.map((o, j) => (j === oi ? fn(o) : o)) } : m)))

  const macrosOf = (it: Item): Macros =>
    itemMacros({ grams: Number(it.grams) || 0, food: it.foodId ? foodById.get(it.foodId) ?? null : null, kcal: Number(it.kcal) || 0, protein: Number(it.protein) || 0, carbs: Number(it.carbs) || 0, fat: Number(it.fat) || 0 })
  const optionTotal = (o: Option) => roundMacros(sumMacros(o.items.map(macrosOf)))
  const dayTotal = roundMacros(sumMacros(meals.map((m) => (m.options[activeOpt[m.key] ?? 0] ? optionTotal(m.options[activeOpt[m.key] ?? 0]) : { kcal: 0, protein: 0, carbs: 0, fat: 0 }))))

  async function save() {
    setSaving(true)
    try {
      const saved = await api<{ meals: { id: string; options: { id: string }[] }[] }>(`/api/coaching/meal-plans/${plan.id}`, "PUT", { ...meta, meals })
      setMeals((ms) => ms.map((m, i) => ({ ...m, id: saved.meals[i]?.id ?? m.id, options: m.options.map((o, j) => ({ ...o, id: saved.meals[i]?.options[j]?.id ?? o.id })) })))
      setDirty(false)
      toast.success("Plan guardado")
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function assign() {
    if (dirty) await save()
    try {
      await api(`/api/coaching/meal-plans/${plan.id}/assign`, "POST", { clientIds: selected })
      toast.success(`Asignado a ${selected.length} cliente(s)`)
      setAssignOpen(false)
      setSelected([])
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const target = (k: keyof Targets) => Number(meta[k]) || 0
  const bar = (label: string, value: number, t: number, unit: string) => (
    <div className="min-w-0">
      <div className="flex justify-between text-xs"><span className="text-gray-500">{label}</span><span className="font-medium">{value}{t ? ` / ${t}` : ""} {unit}</span></div>
      <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
        <div className={cn("h-full rounded-full", t && value > t * 1.05 ? "bg-red-500" : "bg-orange-500")} style={{ width: `${t ? Math.min(100, (value / t) * 100) : 0}%` }} />
      </div>
    </div>
  )

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <Link href={plan.client ? `/coaching/clients/${plan.client.id}?tab=nutrition` : "/coaching/nutrition"} className="text-xs text-gray-500 hover:text-gray-800">← {plan.client?.name ?? "Nutrición"}</Link>
          <h1 className="text-xl font-bold">{plan.isTemplate ? "Plantilla nutricional" : `Plan de ${plan.client?.name}`}</h1>
          {dirty && <p className="text-xs text-amber-600">Cambios sin guardar</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.isTemplate && <Btn variant="outline" onClick={() => setAssignOpen(true)}><Users className="h-4 w-4" /> Asignar a clientes</Btn>}
          <Btn variant="outline" onClick={async () => { if (dirty) await save(); const p = await api<{ id: string }>("/api/coaching/meal-plans", "POST", { copyFrom: plan.id, name: `${meta.name} (copia)` }); router.push(`/coaching/nutrition/${p.id}`) }}>
            <Copy className="h-4 w-4" /> Duplicar como plantilla
          </Btn>
          <Btn variant="danger" onClick={async () => { if (!confirm("¿Eliminar este plan?")) return; await api(`/api/coaching/meal-plans/${plan.id}`, "DELETE"); router.push(plan.client ? `/coaching/clients/${plan.client.id}?tab=nutrition` : "/coaching/nutrition") }}>
            <Trash2 className="h-4 w-4" />
          </Btn>
          <Btn onClick={save} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar"}</Btn>
        </div>
      </div>

      <Panel>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Field label="Nombre" className="col-span-2"><Input value={meta.name} onChange={(e) => { setMeta({ ...meta, name: e.target.value }); setDirty(true) }} /></Field>
          <Field label="Kcal objetivo"><Input type="number" value={meta.calTarget} onChange={(e) => { setMeta({ ...meta, calTarget: e.target.value }); setDirty(true) }} /></Field>
          <Field label="Proteína (g)"><Input type="number" value={meta.proteinTarget} onChange={(e) => { setMeta({ ...meta, proteinTarget: e.target.value }); setDirty(true) }} /></Field>
          <Field label="Carbs (g)"><Input type="number" value={meta.carbsTarget} onChange={(e) => { setMeta({ ...meta, carbsTarget: e.target.value }); setDirty(true) }} /></Field>
          <Field label="Grasas (g)"><Input type="number" value={meta.fatTarget} onChange={(e) => { setMeta({ ...meta, fatTarget: e.target.value }); setDirty(true) }} /></Field>
          <Field label="Indicaciones para el cliente" className="col-span-2 md:col-span-5">
            <Textarea value={meta.description} placeholder="Ej: Puedes intercambiar opciones dentro de la misma comida. Verduras libres. 2.5 L de agua." onChange={(e) => { setMeta({ ...meta, description: e.target.value }); setDirty(true) }} />
          </Field>
          <div className="flex flex-col gap-2 justify-end">
            {plan.clientTargets && (
              <Btn size="sm" variant="outline" onClick={() => { setMeta({ ...meta, ...plan.clientTargets! }); setDirty(true) }}>Usar objetivos del cliente</Btn>
            )}
            {!plan.isTemplate && (
              <Select value={meta.isActive ? "1" : "0"} onChange={(e) => { setMeta({ ...meta, isActive: e.target.value === "1" }); setDirty(true) }}>
                <option value="1">Activo</option><option value="0">Archivado</option>
              </Select>
            )}
          </div>
        </div>
      </Panel>

      <div className="sticky top-[104px] md:top-[112px] z-20 bg-white/95 backdrop-blur rounded-xl border border-gray-200 p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        {bar("Calorías", dayTotal.kcal, target("calTarget"), "kcal")}
        {bar("Proteína", dayTotal.protein, target("proteinTarget"), "g")}
        {bar("Carbohidratos", dayTotal.carbs, target("carbsTarget"), "g")}
        {bar("Grasas", dayTotal.fat, target("fatTarget"), "g")}
        <p className="col-span-2 md:col-span-4 text-[11px] text-gray-400">Total del día con las opciones seleccionadas en cada comida.</p>
      </div>

      <div className="space-y-4">
        {meals.map((meal, mi) => {
          const oi = Math.min(activeOpt[meal.key] ?? 0, Math.max(0, meal.options.length - 1))
          const option = meal.options[oi]
          return (
            <Panel key={meal.key}>
              <div className="flex flex-wrap gap-2 items-end mb-3">
                <Field label="Comida" className="flex-1 min-w-40"><Input className="font-semibold" value={meal.name} onChange={(e) => updateMeal(mi, { name: e.target.value })} /></Field>
                <Field label="Hora" className="w-28"><Input type="time" value={meal.time} onChange={(e) => updateMeal(mi, { time: e.target.value })} /></Field>
                <Btn size="sm" variant="ghost" onClick={() => update((ms) => move(ms, mi, -1))}><ArrowUp className="h-4 w-4" /></Btn>
                <Btn size="sm" variant="ghost" onClick={() => update((ms) => move(ms, mi, 1))}><ArrowDown className="h-4 w-4" /></Btn>
                <Btn size="sm" variant="ghost" onClick={() => { if (confirm(`¿Eliminar ${meal.name}?`)) update((ms) => ms.filter((_, i) => i !== mi)) }}><Trash2 className="h-4 w-4 text-red-500" /></Btn>
              </div>

              <div className="flex gap-1 flex-wrap mb-3">
                {meal.options.map((o, j) => {
                  const t = optionTotal(o)
                  return (
                    <button key={o.key} onClick={() => setActiveOpt((s) => ({ ...s, [meal.key]: j }))} className={cn("px-3 py-1.5 rounded-lg text-xs border", j === oi ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 hover:border-gray-400")}>
                      {o.label} · {t.kcal} kcal
                    </button>
                  )
                })}
                <button
                  onClick={() => {
                    update((ms) => ms.map((m, i) => (i === mi ? { ...m, options: [...m.options, { key: uid(), label: letter(m.options.length), notes: "", items: [] }] } : m)))
                    setActiveOpt((s) => ({ ...s, [meal.key]: meal.options.length }))
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs border border-dashed border-gray-300 text-gray-500 hover:border-orange-400"
                >
                  + Opción
                </button>
              </div>

              {option && (
                <div className="rounded-lg border border-gray-100 p-3 space-y-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    <Input className="h-8 w-40" value={option.label} onChange={(e) => updateOption(mi, oi, (o) => ({ ...o, label: e.target.value }))} />
                    <Input className="h-8 flex-1 min-w-40" placeholder="Nota de la opción (ej: preparar a la plancha)" value={option.notes} onChange={(e) => updateOption(mi, oi, (o) => ({ ...o, notes: e.target.value }))} />
                    <Btn size="sm" variant="ghost" title="Duplicar opción" onClick={() => {
                      update((ms) => ms.map((m, i) => (i === mi ? { ...m, options: [...m.options, { ...option, id: undefined, key: uid(), label: letter(m.options.length), items: option.items.map((it) => ({ ...it, key: uid() })) }] } : m)))
                      setActiveOpt((s) => ({ ...s, [meal.key]: meal.options.length }))
                    }}><Copy className="h-3.5 w-3.5" /></Btn>
                    {meal.options.length > 1 && (
                      <Btn size="sm" variant="ghost" onClick={() => { update((ms) => ms.map((m, i) => (i === mi ? { ...m, options: m.options.filter((_, j) => j !== oi) } : m))); setActiveOpt((s) => ({ ...s, [meal.key]: 0 })) }}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Btn>
                    )}
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-50">
                      {option.items.map((it, ii) => {
                        const food = it.foodId ? foodById.get(it.foodId) : null
                        const m = roundMacros(macrosOf(it))
                        const setItem = (patch: Partial<Item>) => updateOption(mi, oi, (o) => ({ ...o, items: o.items.map((x, k) => (k === ii ? { ...x, ...patch } : x)) }))
                        return (
                          <tr key={it.key}>
                            <td className="py-1.5 pr-2">
                              {food ? (
                                <>
                                  <p className="font-medium">{food.name}</p>
                                  <p className="text-[11px] text-gray-400">{quantityLabel(Number(it.grams) || 0, food)}</p>
                                </>
                              ) : (
                                <Input className="h-8" placeholder="Ej: Ensalada libre" value={it.customName} onChange={(e) => setItem({ customName: e.target.value })} />
                              )}
                            </td>
                            <td className="py-1.5 pr-2 w-36">
                              {food ? (
                                <div className="flex items-center gap-1">
                                  <Input className="h-8 w-20" type="number" value={it.grams} onChange={(e) => setItem({ grams: e.target.value })} />
                                  <span className="text-xs text-gray-400">g</span>
                                  {food.unitGrams && (
                                    <button className="text-[10px] text-orange-600 whitespace-nowrap" title={`+1 ${food.unitName}`} onClick={() => setItem({ grams: String((Number(it.grams) || 0) + food.unitGrams!) })}>
                                      +1 {food.unitName?.split(" ")[0]}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="grid grid-cols-4 gap-1">
                                  {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
                                    <Input key={k} className="h-8 px-1 text-xs" placeholder={{ kcal: "kcal", protein: "P", carbs: "C", fat: "G" }[k]} value={it[k]} onChange={(e) => setItem({ [k]: e.target.value } as Partial<Item>)} />
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-1.5 text-xs text-gray-500 whitespace-nowrap text-right">{m.kcal} kcal · P{m.protein} C{m.carbs} G{m.fat}</td>
                            <td className="py-1.5 w-8 text-right">
                              <button className="p-1 text-gray-400 hover:text-red-500" onClick={() => updateOption(mi, oi, (o) => ({ ...o, items: o.items.filter((_, k) => k !== ii) }))}><Trash2 className="h-3.5 w-3.5" /></button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex gap-2">
                      <Btn size="sm" variant="outline" onClick={() => setPicker({ mi, oi })}><Plus className="h-3.5 w-3.5" /> Alimento</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => updateOption(mi, oi, (o) => ({ ...o, items: [...o.items, { key: uid(), foodId: null, customName: "", grams: "0", kcal: "", protein: "", carbs: "", fat: "" }] }))}>+ Item libre</Btn>
                    </div>
                    {(() => { const t = optionTotal(option); return <p className="text-sm font-semibold">{t.kcal} kcal <span className="text-xs font-normal text-gray-500">· P {t.protein} g · C {t.carbs} g · G {t.fat} g</span></p> })()}
                  </div>
                </div>
              )}
            </Panel>
          )
        })}
        <Btn variant="outline" className="w-full" onClick={() => update((ms) => [...ms, { key: uid(), name: `Comida ${ms.length + 1}`, time: "", options: [{ key: uid(), label: "Opción A", notes: "", items: [] }] }])}>
          <Plus className="h-4 w-4" /> Añadir comida
        </Btn>
      </div>

      <FoodPicker
        open={!!picker}
        foods={foods}
        onClose={() => setPicker(null)}
        onPick={(food) => {
          if (!picker) return
          const grams = food.unitGrams ?? 100
          updateOption(picker.mi, picker.oi, (o) => ({ ...o, items: [...o.items, { key: uid(), foodId: food.id, customName: "", grams: String(grams), kcal: "", protein: "", carbs: "", fat: "" }] }))
          setPicker(null)
        }}
      />

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Asignar plan a clientes">
        <p className="text-xs text-gray-500 mb-2">Cada cliente recibe su propia copia. Su plan activo actual se archivará.</p>
        <div className="max-h-72 overflow-y-auto divide-y border rounded-lg">
          {clients.map((c) => (
            <label key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <input type="checkbox" checked={selected.includes(c.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))} />
              {c.name}
            </label>
          ))}
        </div>
        <Btn className="w-full mt-3" onClick={assign} disabled={!selected.length}>Asignar ({selected.length})</Btn>
      </Modal>
    </>
  )
}

function FoodPicker({ open, foods, onClose, onPick }: { open: boolean; foods: Food[]; onClose: () => void; onPick: (f: Food) => void }) {
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("")
  const list = foods.filter((f) => (!cat || f.category === cat) && f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 80)
  return (
    <Modal open={open} onClose={onClose} title="Añadir alimento">
      <div className="space-y-2">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
          <Input autoFocus className="pl-8" placeholder="Buscar alimento…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {Object.entries(FOOD_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <div className="max-h-80 overflow-y-auto divide-y border rounded-lg">
          {list.map((f) => (
            <button key={f.id} className="w-full text-left px-3 py-2 hover:bg-orange-50" onClick={() => onPick(f)}>
              <p className="text-sm font-medium">{f.name}</p>
              <p className="text-xs text-gray-500">{Math.round(f.kcal)} kcal · P {f.protein} · C {f.carbs} · G {f.fat} <span className="text-gray-400">/100 g{f.unitName ? ` · 1 ${f.unitName} = ${f.unitGrams} g` : ""}</span></p>
            </button>
          ))}
          {!list.length && <p className="p-3 text-sm text-gray-500">Sin resultados. Crea el alimento en la pestaña Alimentos.</p>}
        </div>
      </div>
    </Modal>
  )
}
