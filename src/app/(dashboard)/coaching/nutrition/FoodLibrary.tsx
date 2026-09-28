"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Search } from "lucide-react"
import { FOOD_CATEGORIES } from "@/lib/coaching/constants"
import { Btn, Field, Input, Modal, Panel, Select, api } from "@/components/coaching/kit"

type Food = { id: string; name: string; category: string; kcal: number; protein: number; carbs: number; fat: number; unitName: string | null; unitGrams: number | null; isCustom: boolean; used: number }
const EMPTY = { name: "", category: "PROTEINAS", kcal: "", protein: "", carbs: "", fat: "", unitName: "", unitGrams: "" }

export default function FoodLibrary({ foods }: { foods: Food[] }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("")
  const [editing, setEditing] = useState<Food | "new" | null>(null)
  const [f, setF] = useState(EMPTY)
  const list = foods.filter((x) => (!cat || x.category === cat) && x.name.toLowerCase().includes(q.toLowerCase()))

  function open(x: Food | "new") {
    setEditing(x)
    setF(x === "new" ? EMPTY : { name: x.name, category: x.category, kcal: String(x.kcal), protein: String(x.protein), carbs: String(x.carbs), fat: String(x.fat), unitName: x.unitName ?? "", unitGrams: x.unitGrams ? String(x.unitGrams) : "" })
  }

  async function save() {
    try {
      if (editing === "new") await api("/api/coaching/foods", "POST", f)
      else if (editing) await api(`/api/coaching/foods/${editing.id}`, "PATCH", f)
      setEditing(null)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const estKcal = Math.round((Number(f.protein) || 0) * 4 + (Number(f.carbs) || 0) * 4 + (Number(f.fat) || 0) * 9)

  return (
    <Panel>
      <div className="flex flex-col md:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
          <Input className="pl-8" placeholder={`Buscar entre ${foods.length} alimentos…`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="md:w-48" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {Object.entries(FOOD_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Btn onClick={() => open("new")}><Plus className="h-4 w-4" /> Nuevo alimento</Btn>
      </div>
      {!foods.length && <p className="text-sm text-gray-500 py-6 text-center">Sin alimentos. Usa “Cargar biblioteca base” en el Dashboard o en Ejercicios.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 text-left">
            <tr>
              <th className="py-2 font-medium">Alimento (por 100 g)</th>
              <th className="py-2 px-2 font-medium">Kcal</th>
              <th className="py-2 px-2 font-medium">Prot.</th>
              <th className="py-2 px-2 font-medium">Carbs</th>
              <th className="py-2 px-2 font-medium">Grasas</th>
              <th className="py-2 px-2 font-medium">Porción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((x) => (
              <tr key={x.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => open(x)}>
                <td className="py-2">
                  {x.name}
                  <span className="text-[10px] text-gray-400 ml-1.5">{FOOD_CATEGORIES[x.category]}</span>
                  {x.isCustom && <span className="text-[10px] bg-orange-50 text-orange-600 rounded px-1 ml-1">Propio</span>}
                </td>
                <td className="py-2 px-2">{Math.round(x.kcal)}</td>
                <td className="py-2 px-2">{x.protein}</td>
                <td className="py-2 px-2">{x.carbs}</td>
                <td className="py-2 px-2">{x.fat}</td>
                <td className="py-2 px-2 text-xs text-gray-500">{x.unitName ? `1 ${x.unitName} = ${x.unitGrams} g` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nuevo alimento" : "Editar alimento"}>
        <div className="space-y-3">
          <Field label="Nombre"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Categoría">
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {Object.entries(FOOD_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <p className="text-xs text-gray-500">Valores por 100 g (o 100 ml)</p>
          <div className="grid grid-cols-4 gap-2">
            <Field label="Kcal" hint={estKcal ? `≈ ${estKcal} por macros` : undefined}><Input type="number" value={f.kcal} onChange={(e) => setF({ ...f, kcal: e.target.value })} /></Field>
            <Field label="Proteína"><Input type="number" value={f.protein} onChange={(e) => setF({ ...f, protein: e.target.value })} /></Field>
            <Field label="Carbs"><Input type="number" value={f.carbs} onChange={(e) => setF({ ...f, carbs: e.target.value })} /></Field>
            <Field label="Grasas"><Input type="number" value={f.fat} onChange={(e) => setF({ ...f, fat: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Unidad (opcional)"><Input placeholder="unidad, rebanada…" value={f.unitName} onChange={(e) => setF({ ...f, unitName: e.target.value })} /></Field>
            <Field label="Gramos por unidad"><Input type="number" value={f.unitGrams} onChange={(e) => setF({ ...f, unitGrams: e.target.value })} /></Field>
          </div>
          <div className="flex justify-between">
            {editing && editing !== "new" ? (
              <Btn variant="danger" onClick={async () => { try { await api(`/api/coaching/foods/${editing.id}`, "DELETE"); setEditing(null); router.refresh() } catch (e) { toast.error((e as Error).message) } }}>Eliminar</Btn>
            ) : <span />}
            <Btn onClick={save} disabled={!f.name}>Guardar</Btn>
          </div>
        </div>
      </Modal>
    </Panel>
  )
}
