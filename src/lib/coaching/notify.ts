import { prisma } from "@/lib/prisma"
import { pushToClient, pushToCoaches } from "./push"

type NotifyInput = { type: string; title: string; body?: string | null; link?: string | null }

/** Notificación en la app del cliente + push a sus dispositivos. */
export async function notifyClient(clientId: string, n: NotifyInput) {
  const notification = await prisma.notification.create({
    data: { clientId, audience: "CLIENT", type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null },
  })
  await pushToClient(clientId, { title: n.title, body: n.body, link: n.link, tag: n.type })
  return notification
}

/** Notificación en el panel del entrenador + push a los dispositivos del staff ADMIN. */
export async function notifyCoach(n: NotifyInput & { clientId?: string | null }) {
  const notification = await prisma.notification.create({
    data: { clientId: n.clientId ?? null, audience: "COACH", type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null },
  })
  await pushToCoaches({ title: n.title, body: n.body, link: n.link, tag: n.type })
  return notification
}

/** Mensaje del entrenador en el chat + notificación al cliente. */
export async function sendCoachMessage(clientId: string, body: string, sender: "COACH" | "SYSTEM" = "COACH", attachment?: { url: string; type: string } | null) {
  const msg = await prisma.coachMessage.create({
    data: { clientId, sender, body, attachmentUrl: attachment?.url ?? null, attachmentType: attachment?.type ?? null },
  })
  await notifyClient(clientId, {
    type: "MESSAGE",
    title: "Nuevo mensaje de tu coach",
    body: body.length > 90 ? `${body.slice(0, 87)}…` : body,
    link: "/app/chat",
  })
  return msg
}

export function fillTemplate(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}
