import { NextResponse } from "next/server"
import { requireClient, jsonError, str } from "@/lib/coaching/auth"
import { mpEnabled, processMpPayment } from "@/lib/coaching/mercadopago"

/** Al volver de Mercado Pago confirmamos el pago sin esperar al webhook. */
export async function POST(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  if (!mpEnabled()) return jsonError("Pagos online no habilitados", 503)
  const mpPaymentId = str((await request.json()).paymentId)
  if (!mpPaymentId || !/^\d+$/.test(mpPaymentId)) return jsonError("Pago inválido")
  try {
    return NextResponse.json(await processMpPayment(mpPaymentId, guard.clientId))
  } catch (e) {
    console.error(e)
    return jsonError("No se pudo verificar el pago", 502)
  }
}
