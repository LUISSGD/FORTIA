import { NextResponse } from "next/server"
import { mpEnabled, processMpPayment, verifyWebhookSignature } from "@/lib/coaching/mercadopago"

/**
 * Webhook de Mercado Pago (notificaciones de pagos). Público: se valida la firma
 * `x-signature` y, además, el estado siempre se consulta directamente a la API de Mercado Pago.
 */
export async function POST(request: Request) {
  if (!mpEnabled()) return NextResponse.json({ ok: true })
  const url = new URL(request.url)
  const body = await request.json().catch(() => ({}))
  const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic")
  const dataId = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "")
  if (type !== "payment" || !/^\d+$/.test(dataId)) return NextResponse.json({ ok: true })

  if (process.env.MP_WEBHOOK_SECRET && !verifyWebhookSignature(request, dataId)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 })
  }
  try {
    const result = await processMpPayment(dataId)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error("Webhook Mercado Pago:", e)
    // 500 → Mercado Pago reintenta más tarde
    return NextResponse.json({ error: "Error procesando el pago" }, { status: 500 })
  }
}
