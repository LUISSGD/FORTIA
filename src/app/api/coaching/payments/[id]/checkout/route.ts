import { NextResponse } from "next/server"
import { requireCoach, jsonError } from "@/lib/coaching/auth"
import { appUrl, createCheckout, mpEnabled } from "@/lib/coaching/mercadopago"

type Params = { params: Promise<{ id: string }> }

/** Link de pago de Mercado Pago para enviarlo al cliente (WhatsApp, chat…). */
export async function POST(request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  if (!mpEnabled()) return jsonError("Configura MP_ACCESS_TOKEN para habilitar Mercado Pago", 503)
  const { id } = await params
  try {
    return NextResponse.json({ url: await createCheckout(id, appUrl(request)) })
  } catch (e) {
    return jsonError((e as Error).message, 502)
  }
}
