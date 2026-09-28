import crypto from "node:crypto"
import { prisma } from "@/lib/prisma"
import { periodLabel } from "./dates"
import { markPaymentPaid } from "./payments"
import { notifyCoach } from "./notify"

// Integración con Mercado Pago Checkout Pro (API REST, sin SDK).
const API = process.env.MP_API_URL ?? "https://api.mercadopago.com"
const TOKEN = process.env.MP_ACCESS_TOKEN

export const mpEnabled = () => !!TOKEN

async function mp<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${(data as { message?: string }).message ?? "error"}`)
  return data as T
}

/** URL pública de la app (para back_urls y webhook). */
export function appUrl(request: Request) {
  return (process.env.APP_URL ?? new URL(request.url).origin).replace(/\/$/, "")
}

/** Crea (o reutiliza) la preferencia de Checkout Pro de una mensualidad y devuelve el link de pago. */
export async function createCheckout(paymentId: string, baseUrl: string) {
  const payment = await prisma.coachingPayment.findUnique({
    where: { id: paymentId },
    include: { client: { select: { firstName: true, lastName: true, email: true, coachingProfile: { select: { planName: true } } } } },
  })
  if (!payment) throw new Error("Mensualidad no encontrada")
  if (payment.status === "PAID") throw new Error("Esta mensualidad ya está pagada")

  const pref = await mp<{ id: string; init_point: string }>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          id: payment.id,
          title: `${payment.client.coachingProfile?.planName ?? "FORTIA Coaching"} — ${periodLabel(payment.period)}`,
          quantity: 1,
          unit_price: Math.round(payment.amount * 100) / 100,
          currency_id: payment.currency,
        },
      ],
      payer: payment.client.email ? { email: payment.client.email, name: payment.client.firstName, surname: payment.client.lastName } : undefined,
      external_reference: payment.id,
      statement_descriptor: "FORTIA",
      back_urls: {
        success: `${baseUrl}/app/profile?pago=ok`,
        pending: `${baseUrl}/app/profile?pago=pendiente`,
        failure: `${baseUrl}/app/profile?pago=error`,
      },
      auto_return: "approved",
      notification_url: `${baseUrl}/api/mercadopago/webhook`,
    }),
  })
  await prisma.coachingPayment.update({ where: { id: payment.id }, data: { mpPreferenceId: pref.id } })
  return pref.init_point
}

type MpPayment = { id: number; status: string; external_reference: string | null; transaction_amount: number; currency_id: string; date_approved: string | null }

/**
 * Consulta el pago en Mercado Pago (fuente de verdad) y, si está aprobado y coincide
 * con la mensualidad, la marca como pagada. Idempotente.
 */
export async function processMpPayment(mpPaymentId: string, expectedClientId?: string) {
  const p = await mp<MpPayment>(`/v1/payments/${encodeURIComponent(mpPaymentId)}`)
  if (!p.external_reference) return { status: p.status, applied: false }
  const payment = await prisma.coachingPayment.findUnique({ where: { id: p.external_reference }, include: { client: { select: { firstName: true, lastName: true } } } })
  if (!payment) return { status: p.status, applied: false }
  if (expectedClientId && payment.clientId !== expectedClientId) return { status: p.status, applied: false }
  if (p.status !== "approved") return { status: p.status, applied: false }
  if (p.currency_id !== payment.currency || p.transaction_amount + 0.01 < payment.amount) {
    console.error("Mercado Pago: monto o moneda no coinciden", p.id, p.transaction_amount, p.currency_id)
    return { status: p.status, applied: false }
  }
  const updated = await markPaymentPaid(payment.id, {
    amount: p.transaction_amount,
    paidAt: p.date_approved ? new Date(p.date_approved) : new Date(),
    method: "MERCADOPAGO",
    mpPaymentId: String(p.id),
  })
  if (updated) {
    await notifyCoach({
      clientId: payment.clientId,
      type: "PAYMENT",
      title: `💳 ${payment.client.firstName} pagó con Mercado Pago`,
      body: `${periodLabel(payment.period)} · ${payment.currency === "USD" ? "$" : "S/"}${p.transaction_amount}`,
      link: "/coaching/payments",
    })
  }
  return { status: p.status, applied: !!updated }
}

/**
 * Valida la firma `x-signature` del webhook (HMAC-SHA256 con la clave secreta de la aplicación).
 * Manifest: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 */
export function verifyWebhookSignature(request: Request, dataId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return false
  const sig = request.headers.get("x-signature") ?? ""
  const requestId = request.headers.get("x-request-id") ?? ""
  const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=").map((x) => x.trim())))
  if (!parts.ts || !parts.v1) return false
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(parts.v1)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
