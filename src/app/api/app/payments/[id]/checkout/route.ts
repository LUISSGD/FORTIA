import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireClient, jsonError } from "@/lib/coaching/auth"
import { appUrl, createCheckout, mpEnabled } from "@/lib/coaching/mercadopago"

type Params = { params: Promise<{ id: string }> }

/** El cliente inicia el pago de su mensualidad en Mercado Pago. */
export async function POST(request: Request, { params }: Params) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  if (!mpEnabled()) return jsonError("Los pagos online no están habilitados", 503)
  const { id } = await params
  const payment = await prisma.coachingPayment.findFirst({ where: { id, clientId: guard.clientId } })
  if (!payment) return jsonError("Mensualidad no encontrada", 404)
  try {
    return NextResponse.json({ url: await createCheckout(payment.id, appUrl(request)) })
  } catch (e) {
    console.error(e)
    return jsonError((e as Error).message, 502)
  }
}
