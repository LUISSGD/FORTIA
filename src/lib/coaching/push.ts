import webpush from "web-push"
import { prisma } from "@/lib/prisma"

// Notificaciones push (Web Push / VAPID). Si faltan las claves, no hace nada.
const PUBLIC = process.env.VAPID_PUBLIC_KEY
const PRIVATE = process.env.VAPID_PRIVATE_KEY
const enabled = !!(PUBLIC && PRIVATE)
if (enabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@fortia.pe", PUBLIC!, PRIVATE!)

export const pushPublicKey = () => PUBLIC ?? null

type Payload = { title: string; body?: string | null; link?: string | null; tag?: string }

async function sendTo(where: { userId?: { in: string[] }; user?: { role: string } | { clientId: string } }, payload: Payload) {
  if (!enabled) return
  const subs = await prisma.pushSubscription.findMany({ where })
  if (!subs.length) return
  const data = JSON.stringify({ title: payload.title, body: payload.body ?? "", url: payload.link ?? "/", tag: payload.tag })
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data, { TTL: 60 * 60 * 24 })
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        // Suscripción caducada o revocada: se elimina
        if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
        else console.error("Web push error:", status, (e as Error).message)
      }
    })
  )
}

export const pushToClient = (clientId: string, payload: Payload) => sendTo({ user: { clientId } }, payload)
export const pushToCoaches = (payload: Payload) => sendTo({ user: { role: "ADMIN" } }, payload)
