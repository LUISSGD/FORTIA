"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

/** Botón para pagar la mensualidad pendiente con Mercado Pago (Checkout Pro). */
export function PayOnlineButton({ paymentId, label }: { paymentId: string; label: string }) {
  const [busy, setBusy] = useState(false)
  async function pay() {
    setBusy(true)
    const res = await fetch(`/api/app/payments/${paymentId}/checkout`, { method: "POST" })
    const d = await res.json().catch(() => ({}))
    if (!res.ok || !d.url) {
      setBusy(false)
      return toast.error(d.error ?? "No se pudo iniciar el pago")
    }
    window.location.href = d.url
  }
  return (
    <button onClick={pay} disabled={busy} className="mt-3 w-full h-12 rounded-xl bg-[#009ee3] text-white font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "💳"} {label}
    </button>
  )
}

/** Al volver de Mercado Pago (?pago=ok&payment_id=…) confirma el pago y avisa al cliente. */
export function PaymentReturn() {
  const sp = useSearchParams()
  const router = useRouter()
  const done = useRef(false)
  useEffect(() => {
    const result = sp.get("pago")
    if (!result || done.current) return
    done.current = true
    const paymentId = sp.get("payment_id") ?? sp.get("collection_id")
    ;(async () => {
      if (result === "error") toast.error("El pago no se completó. Puedes intentarlo de nuevo.")
      else if (paymentId && /^\d+$/.test(paymentId)) {
        const res = await fetch("/api/app/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId }) })
        const d = await res.json().catch(() => ({}))
        if (d.status === "approved") toast.success("✅ ¡Pago recibido! Gracias.")
        else if (d.status === "pending" || d.status === "in_process") toast.info("⏳ Tu pago está en proceso. Te avisaremos cuando se confirme.")
        else if (result === "pendiente") toast.info("⏳ Tu pago está pendiente de confirmación.")
        else toast.error("No pudimos confirmar el pago todavía.")
      } else if (result === "pendiente") toast.info("⏳ Tu pago está pendiente de confirmación.")
      router.replace("/app/profile")
      router.refresh()
    })()
  }, [sp, router])
  return null
}
