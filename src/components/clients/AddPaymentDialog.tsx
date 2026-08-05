"use client"

import { useState, useRef } from "react"
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

type PaymentType = "membership" | "training"

const CLASES_OPTIONS: ClasesPerPack[] = [4, 8, 12, 16]
const CLASES_LABELS: Record<number, string> = { 4: "4 clases/pack", 8: "8 clases/pack", 12: "12 clases/pack", 16: "16 clases/pack" }

export default function AddPaymentDialog({ clientId, clientName, plans, currentPlanId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paymentType, setPaymentType] = useState<PaymentType>("membership")

  // Membership fields
  const [planId, setPlanId] = useState(currentPlanId ?? "")
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))

  // Training fields
  const [entrenador, setEntrenador] = useState<Entrenador>("HEAD_COACH")
  const [modalidad, setModalidad] = useState<Modalidad>("ELITE_ATHLETE")
  const [tarifa, setTarifa] = useState<Tarifa>("REGULAR")
  const [numPacks, setNumPacks] = useState<NumPacks>(1)
  const [clasesPerPack, setClasesPerPack] = useState<ClasesPerPack>(8)

  // Shared
  const [amount, setAmount] = useState("")
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
    if (!isOpen) removeFile()
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

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          paymentType === "membership"
            ? { clientId, planId, amount, method, receiptUrl, startDate }
            : {
                clientId,
                amount,
                method,
                receiptUrl,
                paymentType: "training",
                entrenador,
                modalidad,
                tarifa,
                numPacks,
                clasesPerPack,
              }
        ),
      })

      if (res.ok) {
        toast.success(paymentType === "membership" ? "Pago registrado. Membresía renovada." : "Pago de entrenamiento registrado.")
        setOpen(false)
        router.refresh()
      } else {
        toast.error("Error al registrar el pago")
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
              </div>
            </div>

            {/* Membership fields */}
            {paymentType === "membership" && (
              <>
                <div>
                  <Label>Plan</Label>
                  <Select value={planId} onValueChange={(v) => v && handlePlanChange(v)} required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar plan" />
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
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

            {/* Shared: amount */}
            <div>
              <Label>Monto (S/)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min="0"
              />
            </div>

            {/* Shared: method */}
            <div>
              <Label>Método de pago</Label>
              <Select value={method} onValueChange={(v) => v && setMethod(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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

            {paymentType === "membership" && selectedPlan && (
              <p className="text-xs text-gray-500">
                Extenderá la membresía {selectedPlan.durationDays} días desde la fecha de inicio.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 flex-1"
                disabled={loading || (paymentType === "training" && !trainingPrice)}
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
