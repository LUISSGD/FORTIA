import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { jsonError } from "@/lib/coaching/auth"
import { pushPublicKey } from "@/lib/coaching/push"

/** Clave pública VAPID para suscribirse desde el navegador. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return jsonError("No autorizado", 401)
  return NextResponse.json({ publicKey: pushPublicKey() })
}

/** Guarda la suscripción push del dispositivo actual para el usuario logueado. */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return jsonError("No autorizado", 401)
  if (session.user.role === "USER") return jsonError("Sin permisos", 403)
  const body = await request.json()
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null
  const p256dh = body.keys?.p256dh
  const authKey = body.keys?.auth
  if (!endpoint || !/^https:\/\//.test(endpoint) || typeof p256dh !== "string" || typeof authKey !== "string") return jsonError("Suscripción inválida")
  const userAgent = request.headers.get("user-agent")?.slice(0, 250) ?? null
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh, auth: authKey, userId: session.user.id, userAgent },
    update: { p256dh, auth: authKey, userId: session.user.id, userAgent },
  })
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return jsonError("No autorizado", 401)
  const { endpoint } = await request.json().catch(() => ({ endpoint: null }))
  if (typeof endpoint === "string") await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } })
  return NextResponse.json({ ok: true })
}
