"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ChevronDown, ChevronUp, Trash2, CheckCircle, AlertCircle, Calendar, Utensils, Pill } from "lucide-react"
import Link from "next/link"

type Consultation = {
  id: string
  consultationNumber: number
  date: string
  weight: number | null
  height: number | null
  bodyFat: number | null
  muscleMass: number | null
  visceralFat: number | null
  waist: number | null
  hips: number | null
  arms: number | null
  goal: string | null
  calTarget: number | null
  proteinTarget: number | null
  carbsTarget: number | null
  fatTarget: number | null
  waterTarget: number | null
  dietPlan: string | null
  supplements: string | null
  recommendations: string | null
  observations: string | null
  nextAppointment: string | null
  isPaid: boolean
  paymentAmount: number | null
  paymentMethod: string | null
}

const GOAL_LABELS: Record<string, string> = {
  PERDIDA_PESO: "Pérdida de peso",
  GANANCIA_MUSCULAR: "Ganancia muscular",
  MANTENIMIENTO: "Mantenimiento",
  DEFINICION: "Definición",
  SALUD: "Salud general",
}

function ConsultationCard({
  c,
  prev,
  clientId,
  onDelete,
}: {
  c: Consultation
  prev: Consultation | null
  clientId: string
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(false)

  const weightDiff = prev?.weight && c.weight ? (c.weight - prev.weight).toFixed(1) : null
  const bmi = c.weight && c.height ? (c.weight / Math.pow(c.height / 100, 2)).toFixed(1) : null

  async function markPaid() {
    setMarkingPaid(true)
    const res = await fetch(`/api/nutrition/clients/${clientId}/consultations/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid: true }),
    })
    setMarkingPaid(false)
    if (res.ok) {
      toast.success("Marcado como pagado")
      window.location.reload()
    } else {
      toast.error("Error al actualizar")
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar consulta #${c.consultationNumber}?`)) return
    const res = await fetch(`/api/nutrition/clients/${clientId}/consultations/${c.id}`, {
      method: "DELETE",
    })
    if (res.ok) {
      toast.success("Consulta eliminada")
      onDelete(c.id)
    } else {
      toast.error("Error al eliminar")
    }
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="text-center min-w-[40px]">
            <p className="text-xs text-gray-400">Cita</p>
            <p className="font-bold text-gray-800">#{c.consultationNumber}</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">
              {new Date(c.date).toLocaleDateString("es-PE", { weekday: "short", day: "2-digit", month: "long", year: "numeric" })}
            </p>
            <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
              {c.weight && <span className="font-medium text-gray-700">{c.weight} kg</span>}
              {weightDiff && (
                <span className={Number(weightDiff) < 0 ? "text-green-600" : "text-red-500"}>
                  {Number(weightDiff) > 0 ? "+" : ""}{weightDiff} kg
                </span>
              )}
              {bmi && <span>IMC {bmi}</span>}
              {c.goal && <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{GOAL_LABELS[c.goal] ?? c.goal}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {c.isPaid ? (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle className="h-3.5 w-3.5" />Pagado
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3.5 w-3.5" />Sin pagar
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t p-4 space-y-4 bg-gray-50">
          {/* Measurements grid */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Medidas antropométricas</p>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {[
                { label: "Peso", value: c.weight, unit: "kg" },
                { label: "Talla", value: c.height, unit: "cm" },
                { label: "% Grasa", value: c.bodyFat, unit: "%" },
                { label: "M. Muscular", value: c.muscleMass, unit: "kg" },
                { label: "Grasa Visceral", value: c.visceralFat, unit: "" },
                { label: "Cintura", value: c.waist, unit: "cm" },
                { label: "Cadera", value: c.hips, unit: "cm" },
                { label: "Brazos", value: c.arms, unit: "cm" },
                { label: "IMC", value: bmi, unit: "" },
              ].filter((m) => m.value != null).map((m) => (
                <div key={m.label} className="bg-white rounded-lg p-2 text-center border">
                  <p className="text-xs text-gray-400">{m.label}</p>
                  <p className="font-bold text-gray-800 text-sm">{m.value}{m.unit}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Nutritional targets */}
          {(c.calTarget || c.proteinTarget || c.carbsTarget || c.fatTarget || c.waterTarget) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Objetivos nutricionales</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {c.calTarget && (
                  <div className="bg-orange-50 rounded-lg p-2 text-center border border-orange-100">
                    <p className="text-xs text-orange-400">Calorías</p>
                    <p className="font-bold text-orange-700">{c.calTarget}</p>
                    <p className="text-xs text-orange-400">kcal</p>
                  </div>
                )}
                {c.proteinTarget && (
                  <div className="bg-red-50 rounded-lg p-2 text-center border border-red-100">
                    <p className="text-xs text-red-400">Proteína</p>
                    <p className="font-bold text-red-700">{c.proteinTarget}g</p>
                  </div>
                )}
                {c.carbsTarget && (
                  <div className="bg-yellow-50 rounded-lg p-2 text-center border border-yellow-100">
                    <p className="text-xs text-yellow-600">Carbos</p>
                    <p className="font-bold text-yellow-700">{c.carbsTarget}g</p>
                  </div>
                )}
                {c.fatTarget && (
                  <div className="bg-purple-50 rounded-lg p-2 text-center border border-purple-100">
                    <p className="text-xs text-purple-400">Grasas</p>
                    <p className="font-bold text-purple-700">{c.fatTarget}g</p>
                  </div>
                )}
                {c.waterTarget && (
                  <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-100">
                    <p className="text-xs text-blue-400">Agua</p>
                    <p className="font-bold text-blue-700">{c.waterTarget}L</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Diet plan */}
          {c.dietPlan && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Utensils className="h-3.5 w-3.5" />Plan de alimentación
              </p>
              <div className="bg-white border rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                {c.dietPlan}
              </div>
            </div>
          )}

          {/* Supplements */}
          {c.supplements && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Pill className="h-3.5 w-3.5" />Suplementación
              </p>
              <p className="text-sm text-gray-700 bg-white border rounded-lg p-3">{c.supplements}</p>
            </div>
          )}

          {/* Recommendations & observations */}
          {(c.recommendations || c.observations) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {c.recommendations && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Recomendaciones</p>
                  <p className="text-sm text-gray-700 bg-white border rounded-lg p-3">{c.recommendations}</p>
                </div>
              )}
              {c.observations && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Observaciones</p>
                  <p className="text-sm text-gray-700 bg-white border rounded-lg p-3">{c.observations}</p>
                </div>
              )}
            </div>
          )}

          {/* Next appointment */}
          {c.nextAppointment && (
            <div className="flex items-center gap-2 text-sm bg-orange-50 border border-orange-100 rounded-lg p-3">
              <Calendar className="h-4 w-4 text-orange-500" />
              <span className="text-orange-700">
                Próxima cita:{" "}
                <strong>{new Date(c.nextAppointment).toLocaleDateString("es-PE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</strong>
              </span>
            </div>
          )}

          {/* Payment */}
          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-sm text-gray-600">
              {c.paymentAmount ? (
                <span>S/ {c.paymentAmount.toFixed(2)} — {c.paymentMethod ?? "No especificado"}</span>
              ) : (
                <span className="text-gray-400">Monto no registrado</span>
              )}
            </div>
            <div className="flex gap-2">
              {!c.isPaid && (
                <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50" onClick={markPaid} disabled={markingPaid}>
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  {markingPaid ? "Guardando..." : "Marcar pagado"}
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NutritionClientDetail({
  clientId,
  consultations: initial,
}: {
  clientId: string
  consultations: Consultation[]
}) {
  const [consultations, setConsultations] = useState(initial)

  function handleDelete(id: string) {
    setConsultations((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Historial de consultas</CardTitle>
        <Link href={`/nutrition/${clientId}/consulta`}>
          <Button size="sm" className="bg-green-600 hover:bg-green-700">
            <span className="mr-1">+</span> Nueva consulta
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {consultations.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No hay consultas registradas.</p>
            <Link href={`/nutrition/${clientId}/consulta`} className="text-sm text-green-600 underline mt-1 block">
              Registrar primera consulta
            </Link>
          </div>
        ) : (
          consultations.map((c, i) => (
            <ConsultationCard
              key={c.id}
              c={c}
              prev={consultations[i + 1] ?? null}
              clientId={clientId}
              onDelete={handleDelete}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}
