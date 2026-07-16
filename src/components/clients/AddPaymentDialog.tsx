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

export default function AddPaymentDialog({ clientId, clientName, plans, currentPlanId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [planId, setPlanId] = useState(currentPlanId ?? "")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("CASH")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedPlan = plans.find((p) => p.id === planId)

  function handlePlanChange(id: string) {
    setPlanId(id)
    const plan = plans.find((p) => p.id === id)
    if (plan) setAmount(String(plan.price))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    if (selected) {
      const url = URL.createObjectURL(selected)
      setPreview(url)
    } else {
      setPreview(null)
    }
  }

  function removeFile() {
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleClose(open: boolean) {
    setOpen(open)
    if (!open) {
      removeFile()
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
          setLoading(false)
          return
        }
        const { url } = await uploadRes.json()
        receiptUrl = url
      }

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, planId, amount, method, receiptUrl }),
      })

      if (res.ok) {
        toast.success("Pago registrado. Membresía renovada.")
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
              <Label>Monto (S/)</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required min="0" />
            </div>
            <div>
              <Label>Método de pago</Label>
              <Select value={method} onValueChange={(v) => v && setMethod(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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

            {selectedPlan && (
              <p className="text-xs text-gray-500">
                Extenderá la membresía {selectedPlan.durationDays} días desde hoy (o desde el vencimiento actual si aún no ha expirado).
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600 flex-1" disabled={loading}>
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
