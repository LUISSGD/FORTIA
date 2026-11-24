import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { calendarYmd } from "@/lib/calendar"

// Rutas que usa el bot de WhatsApp (servidor propio). Se autentican con una clave compartida:
// INTEGRATION_API_KEY en Vercel = RENEWALS_API_KEY en el bot. Sin la variable, todo responde 401.

export function botGuard(req: Request): NextResponse | null {
  const expected = process.env.INTEGRATION_API_KEY
  const got = req.headers.get("x-api-key")
  if (!expected || !got) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const a = Buffer.from(expected)
  const b = Buffer.from(got)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  return null
}

/** Últimos 9 dígitos (celular peruano) para comparar "987654321", "+51987654321", "51 987 654 321"… */
export const phoneKey = (phone: string | null | undefined) => String(phone ?? "").replace(/\D/g, "").slice(-9)

export const isYmd = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
export const isHm = (v: unknown): v is string => typeof v === "string" && /^\d{2}:\d{2}$/.test(v)

type MemberRow = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  trainer: string | null
  membershipEnd: Date | null
  membershipPlanId: string | null
  membershipPlan?: { id: string; name: string; price: number; durationDays: number } | null
}

export function toMember(c: MemberRow) {
  return {
    clientId: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    trainer: c.trainer,
    // Día de calendario (YYYY-MM-DD): vence al final de ese día en Lima
    membershipEnd: c.membershipEnd ? calendarYmd(c.membershipEnd) : null,
    planId: c.membershipPlan?.id ?? c.membershipPlanId,
    planName: c.membershipPlan?.name ?? null,
    planPrice: c.membershipPlan?.price ?? null,
    durationDays: c.membershipPlan?.durationDays ?? null,
  }
}
