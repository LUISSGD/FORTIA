"use client"

import { useEffect, useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { PAYMENT_METHODS } from "@/lib/utils"
import { Camera, PlusCircle, X } from "lucide-react"
import Image from "next/image"
import {
  getTrainingPrice,
  getAvailableModalidades,
  getAvailableTarifas,
  getAvailableNumPacks,
  ENTRENADOR_LABELS,
  MODALIDAD_LABELS,
  TARIFA_LABELS,
  type Entrenador,
  type Modalidad,
  type Tarifa,
  type NumPacks,
  type ClasesPerPack,
} from "@/lib/training-pricing"

interface Plan {
  id: string
  name: string
  price: number
  durationDays: number
}

interface Props {
  clientId: string
  clientName: string
  plans: Plan[]
  currentPlanId?: string | null
}

type PaymentType = "membership" | "training" | "nutrition"
type ScheduleSlot = { dayOfWeek: string; startTime: string; endTime: string }

const CLASES_OPTIONS: ClasesPerPack[] = [4, 8, 12, 16]
// dayOfWeek: 0=Lun, 1=Mar, 2=Mié, 3=Jue, 4=Vie, 5=Sáb, 6=Dom (matches PersonalTrainingSection)
const DAYS_OF_WEEK = [
  { value: "0", label: "Lunes" },
  { value: "1", label: "Martes" },
  { value: "2", label: "Miércoles" },
  { value: "3", label: "Jueves" },
  { value: "4", label: "Viernes" },
  { value: "5", label: "Sábado" },
  { value: "6", label: "Domingo" },
]
const CLASES_LABELS: Record<number, string> = { 4: "4 clases/pack", 8: "8 clases/pack", 12: "12 clases/pack", 16: "16 clases/pack" }

export default function AddPaymentDialog({ clientId, clientName, plans, currentPlanId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paymentType, setPaymentType] = useState<PaymentType>("membership")
  // Al cobrar entrenamiento personal se crea también el paquete de clases, salvo que ya tenga uno activo.
  const [createPlan, setCreatePlan] = useState(true)
  const [hasActivePlan, setHasActivePlan] = useState(false)
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([{ dayOfWeek: "0", startTime: "", endTime: "" }])
  useEffect(() => {
    if (!open || paymentType !== "training") return
    fetch(`/api/clients/${clientId}/training-plans`)
      .then((r) => (r.ok ? r.json() : []))
      .then((plans: { status: string; sessionsCompleted: number; numPacks: number; clasesPerPack: number }[]) => {
        const active = plans.some((p) => p.status === "ACTIVE" && p.sessionsCompleted < p.numPacks * p.clasesPerPack)
        setHasActivePlan(active)
        setCreatePlan(!active)
      })
      .catch(() => {})
  }, [open, paymentType, clientId])

  // Membership fields
  const [planId, setPlanId] = useState(currentPlanId ?? "")
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))

  // Training fields
  const [entrenador, setEntrenador] = useState<Entrenador>("HEAD_COACH")
  const [modalidad, setModalidad] = useState<Modalidad>("ELITE_ATHLETE")
  const [tarifa, setTarifa] = useState<Tarifa>("REGULAR")
  const [numPacks, setNumPacks] = useState<NumPacks>(1)
  const [clasesPerPack, setClasesPerPack] = useState<ClasesPerPack>(8)
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))

  // Nutrition fields
  const [nutritionConcept, setNutritionConcept] = useState("")
  const [nutritionDate, setNutritionDate] = useState(() => new Date().toISOString().slice(0, 10))

  // Shared
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState<"PEN" | "USD">("PEN")
  const [method, setMethod] = useState("CASH")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedPlan = plans.find((p) => p.id === planId)
  const availableModalidades = getAvailableModalidades(entrenador)
  const availableTarifas = getAvailableTarifas(entrenador, modalidad)
  const availableNumPacks = getAvailableNumPacks(entrenador, modalidad, tarifa)
  const trainingPrice = getTrainingPrice(entrenador, modalidad, tarifa, numPacks, clasesPerPack)

  function handlePlanChange(id: string) {
    setPlanId(id)
    const plan = plans.find((p) => p.id === id)
    if (plan) setAmount(String(plan.price))
  }

  function handleEntrenadorChange(val: Entrenador) {
    setEntrenador(val)
    const mods = getAvailableModalidades(val)
    const newMod = mods.includes(modalidad) ? modalidad : mods[0]
    setModalidad(newMod)
    const tarifas = getAvailableTarifas(val, newMod)
    const newTarifa = tarifas.includes(tarifa) ? tarifa : tarifas[0]
    setTarifa(newTarifa)
    const packs = getAvailableNumPacks(val, newMod, newTarifa)
    const newPacks = packs.includes(numPacks) ? numPacks : packs[0]
    setNumPacks(newPacks)
    const price = getTrainingPrice(val, newMod, newTarifa, newPacks, clasesPerPack)
    if (price) setAmount(String(price))
  }

  function handleModalidadChange(val: Modalidad) {
    setModalidad(val)
    const tarifas = getAvailableTarifas(entrenador, val)
    const newTarifa = tarifas.includes(tarifa) ? tarifa : tarifas[0]
    setTarifa(newTarifa)
    const packs = getAvailableNumPacks(entrenador, val, newTarifa)
    const newPacks = packs.includes(numPacks) ? numPacks : packs[0]
    setNumPacks(newPacks)
    const price = getTrainingPrice(entrenador, val, newTarifa, newPacks, clasesPerPack)
    if (price) setAmount(String(price))
  }

  function handleTarifaChange(val: Tarifa) {
    setTarifa(val)
    const packs = getAvailableNumPacks(entrenador, modalidad, val)
    const newPacks = packs.includes(numPacks) ? numPacks : packs[0]
    setNumPacks(newPacks)
    const price = getTrainingPrice(entrenador, modalidad, val, newPacks, clasesPerPack)
    if (price) setAmount(String(price))
  }

  function handleNumPacksChange(val: NumPacks) {
    setNumPacks(val)
    const price = getTrainingPrice(entrenador, modalidad, tarifa, val, clasesPerPack)
    if (price) setAmount(String(price))
  }

  function handleClasesChange(val: ClasesPerPack) {
    setClasesPerPack(val)
    const price = getTrainingPrice(entrenador, modalidad, tarifa, numPacks, val)
    if (price) setAmount(String(price))
  }

  function addScheduleSlot() {
    setScheduleSlots((prev) => [...prev, { dayOfWeek: "1", startTime: "", endTime: "" }])
  }
  function removeScheduleSlot(idx: number) {
    setScheduleSlots((prev) => prev.filter((_, i) => i !== idx))
  }
  function updateScheduleSlot(idx: number, key: keyof ScheduleSlot, val: string) {
    setScheduleSlots((prev) => prev.map((s, i) => i === idx ? { ...s, [key]: val } : s))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    if (selected) {
      setPreview(URL.createObjectURL(selected))
    } else {
      setPreview(null)
    }
  }

  function removeFile() {
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleClose(isOpen: boolean) {
    setOpen(isOpen)
    if (!isOpen) {
      removeFile()
      setScheduleSlots([{ dayOfWeek: "0", startTime: "", endTime: "" }])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      let receiptUrl: string | null = null

      if (file) {
        const fd = new FormData()
        fd.append("file", file)
        const uploadRes = await fetch("/api/upload/receipt", { method: "POST", body: fd })
        if (!uploadRes.ok) {
          toast.error("Error al subir el comprobante")
          return
        }
        const { url } = await uploadRes.json()
        receiptUrl = url
      }

      let body: object
      if (paymentType === "membership") {
        body = { clientId, planId, amount, currency, method, receiptUrl, startDate }
      } else if (paymentType === "training") {
        body = {
          clientId, amount, currency, method, receiptUrl,
          paymentType: "training", createPlan, entrenador, modalidad, tarifa, numPacks, clasesPerPack, paymentDate,
          scheduleSlots: createPlan
            ? scheduleSlots
                .filter((s) => s.dayOfWeek && s.startTime && s.endTime)
                .map((s) => ({ dayOfWeek: parseInt(s.dayOfWeek), startTime: s.startTime, endTime: s.endTime }))
            : [],
        }
      } else {
        body = {
          clientId, amount, currency, method, receiptUrl,
          paymentType: "nutrition",
          paymentDate: nutritionDate,
          concept: nutritionConcept || undefined,
        }
      }

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(
          paymentType === "membership" ? "Pago registrado. Membresía renovada." :
          paymentType === "nutrition" ? "Pago de nutrición registrado." :
          "Pago de entrenamiento registrado."
        )
        setOpen(false)
        router.refresh()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? "Error al registrar el pago")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button className="bg-orange-500 hover:bg-orange-600" size="sm" onClick={() => setOpen(true)}>
        <PlusCircle className="h-4 w-4 mr-2" />
        Registrar pago
      </Button>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg w-[95vw]">
          <DialogHeader>
            <DialogTitle>Registrar pago — {clientName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Tipo de pago */}
            <div>
              <Label>Tipo de pago</Label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => { setPaymentType("membership"); setAmount("") }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                    paymentType === "membership"
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-gray-600 border-gray-300 hover:border-orange-400"
                  }`}
                >
                  Membresía
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentType("training"); setAmount(trainingPrice ? String(trainingPrice) : "") }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                    paymentType === "training"
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-gray-600 border-gray-300 hover:border-orange-400"
                  }`}
                >
                  Entrenamiento Personal
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentType("nutrition"); setAmount("") }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                    paymentType === "nutrition"
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-gray-600 border-gray-300 hover:border-orange-400"
                  }`}
                >
                  Nutrición
                </button>
              </div>
            </div>

            {/* Membership fields */}
            {paymentType === "membership" && (
              <>
                <div>
                  <Label>Plan</Label>
                  <Select value={planId} onValueChange={(v) => v && handlePlanChange(v)} required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar plan">
                        {(v: string | null) => plans.find((p) => p.id === v)?.name ?? "Seleccionar plan"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)] max-h-72">
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="whitespace-normal">
                          <span className="block">{p.name}</span>
                          <span className="text-xs text-gray-500">S/ {p.price} · {p.durationDays} días</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Inicio del plan</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">El vencimiento se calculará desde esta fecha.</p>
                </div>
              </>
            )}

            {/* Training fields */}
            {paymentType === "training" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Entrenador</Label>
                    <Select value={entrenador} onValueChange={(v) => handleEntrenadorChange(v as Entrenador)}>
                      <SelectTrigger><SelectValue>{(v: Entrenador) => ENTRENADOR_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {(["HEAD_COACH", "TEAM_FORTIA"] as Entrenador[]).map((e) => (
                          <SelectItem key={e} value={e}>{ENTRENADOR_LABELS[e]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Modalidad</Label>
                    <Select value={modalidad} onValueChange={(v) => handleModalidadChange(v as Modalidad)}>
                      <SelectTrigger><SelectValue>{(v: Modalidad) => MODALIDAD_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {availableModalidades.map((m) => (
                          <SelectItem key={m} value={m}>{MODALIDAD_LABELS[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tarifa</Label>
                    <Select value={tarifa} onValueChange={(v) => handleTarifaChange(v as Tarifa)}>
                      <SelectTrigger><SelectValue>{(v: Tarifa) => TARIFA_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {availableTarifas.map((t) => (
                          <SelectItem key={t} value={t}>{TARIFA_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Clases por pack</Label>
                    <Select value={String(clasesPerPack)} onValueChange={(v) => handleClasesChange(Number(v) as ClasesPerPack)}>
                      <SelectTrigger><SelectValue>{(v: string) => CLASES_LABELS[Number(v) as ClasesPerPack] ?? v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {CLASES_OPTIONS.map((c) => (
                          <SelectItem key={c} value={String(c)}>{CLASES_LABELS[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Número de packs</Label>
                  <div className="flex gap-2 mt-1">
                    {([1, 3, 6] as NumPacks[]).map((n) => {
                      const available = availableNumPacks.includes(n)
                      const price = available ? getTrainingPrice(entrenador, modalidad, tarifa, n, clasesPerPack) : null
                      return (
                        <button
                          key={n}
                          type="button"
                          disabled={!available}
                          onClick={() => handleNumPacksChange(n)}
                          className={`flex-1 py-2 px-1 rounded-md text-sm border transition-colors ${
                            numPacks === n && available
                              ? "bg-orange-500 text-white border-orange-500"
                              : available
                              ? "bg-white text-gray-700 border-gray-300 hover:border-orange-400"
                              : "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                          }`}
                        >
                          <span className="font-medium">{n} pack{n > 1 ? "s" : ""}</span>
                          {price && <span className="block text-xs opacity-80">S/ {price}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <Label>Fecha de pago</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">Define en qué mes se registra el ingreso.</p>
                </div>
                {trainingPrice && (
                  <div className="bg-orange-50 border border-orange-200 rounded-md px-3 py-2 text-sm text-orange-800">
                    Precio calculado: <span className="font-bold">S/ {trainingPrice}</span>
                    {" · "}{numPacks} pack{numPacks > 1 ? "s" : ""} × {clasesPerPack} clases = {numPacks * clasesPerPack} clases totales
                  </div>
                )}
                {!trainingPrice && (
                  <p className="text-xs text-red-500">Esta combinación no está disponible.</p>
                )}
              </>
            )}

            {/* Nutrition fields */}
            {paymentType === "nutrition" && (
              <>
                <div>
                  <Label>Fecha del pago</Label>
                  <Input
                    type="date"
                    value={nutritionDate}
                    onChange={(e) => setNutritionDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Concepto <span className="text-gray-400 font-normal text-xs">(opcional)</span></Label>
                  <Input
                    value={nutritionConcept}
                    onChange={(e) => setNutritionConcept(e.target.value)}
                    placeholder={`Consulta de nutrición — ${clientName}`}
                  />
                </div>
              </>
            )}

            {/* Shared: amount + currency */}
            <div>
              <Label>Monto</Label>
              <div className="flex gap-2 mt-1">
                <div className="flex rounded-md border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCurrency("PEN")}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${currency === "PEN" ? "bg-orange-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                  >
                    S/ PEN
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency("USD")}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${currency === "USD" ? "bg-orange-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                  >
                    $ USD
                  </button>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  min="0"
                  placeholder={currency === "USD" ? "0.00 USD" : "0.00"}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Shared: method */}
            <div>
              <Label>Método de pago</Label>
              <Select value={method} onValueChange={(v) => v && setMethod(v)}>
                <SelectTrigger><SelectValue>{(v: string) => PAYMENT_METHODS[v] ?? v}</SelectValue></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Receipt photo */}
            <div>
              <Label>Comprobante de pago (opcional)</Label>
              <div className="mt-1">
                {preview ? (
                  <div className="relative inline-block">
                    <Image
                      src={preview}
                      alt="Comprobante"
                      width={200}
                      height={200}
                      className="rounded-md border object-cover max-h-40 w-auto"
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={removeFile}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors"
                  >
                    <Camera className="h-4 w-4" />
                    Tomar foto o subir imagen
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {paymentType === "training" && (
              <div className="space-y-3">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="mt-0.5" checked={createPlan} onChange={(e) => setCreatePlan(e.target.checked)} />
                  <span>
                    Crear también el paquete de clases
                    <span className="block text-xs text-gray-500">
                      {hasActivePlan ? "Ya tiene un paquete activo con clases pendientes: márcalo solo si es un paquete nuevo." : "Aparecerá en Entrenamiento Personal y el cliente podrá marcar sus clases desde la app."}
                    </span>
                  </span>
                </label>

                {createPlan && (
                  <div className="pl-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-gray-600">Horarios de clases <span className="text-gray-400 font-normal">(opcional)</span></Label>
                    </div>
                    {scheduleSlots.map((slot, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <select
                          value={slot.dayOfWeek}
                          onChange={(e) => updateScheduleSlot(idx, "dayOfWeek", e.target.value)}
                          className="flex-1 min-w-0 text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                        >
                          {DAYS_OF_WEEK.map((d) => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => updateScheduleSlot(idx, "startTime", e.target.value)}
                          className="w-24 text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                        />
                        <span className="text-xs text-gray-400 shrink-0">a</span>
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => updateScheduleSlot(idx, "endTime", e.target.value)}
                          className="w-24 text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                        />
                        {scheduleSlots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeScheduleSlot(idx)}
                            className="shrink-0 text-gray-400 hover:text-red-500 transition-colors p-0.5"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addScheduleSlot}
                      className="text-xs text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1 transition-colors"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Agregar otro horario
                    </button>
                  </div>
                )}
              </div>
            )}

            {paymentType === "membership" && selectedPlan && (
              <p className="text-xs text-gray-500">
                Extenderá la membresía {selectedPlan.durationDays} días desde la fecha de inicio.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 flex-1"
                disabled={loading || (paymentType === "training" && !trainingPrice) || !amount}
              >
                {loading ? "Registrando..." : "Confirmar pago"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
