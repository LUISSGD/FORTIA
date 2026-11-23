import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseLeadInput } from "@/lib/coaching/leads"
import { notifyAdmin } from "@/lib/coaching/notify"

// Formulario público de la web. Es la única ruta abierta que escribe datos: solo crea interesados y
// nunca devuelve información. Responde siempre igual para no revelar si un celular ya está registrado.

const ORIGINS = (process.env.LEADS_ORIGINS ?? "https://fortia-gym.netlify.app").split(",").map((o) => o.trim()).filter(Boolean)
const MAX_PER_IP_HOUR = 5
const MAX_TOTAL_HOUR = 60

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
})

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin") ?? ""
  if (!ORIGINS.includes(origin)) return new Response(null, { status: 403 })
  return new Response(null, { status: 204, headers: cors(origin) })
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin") ?? ""
  if (!ORIGINS.includes(origin)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 })
  const headers = cors(origin)
  const ok = () => NextResponse.json({ ok: true }, { headers })
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers })

  const raw = await request.text()
  if (raw.length > 4000) return fail("Datos demasiado largos", 413)
  let body: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail("Datos no válidos")
    body = parsed
  } catch {
    return fail("Datos no válidos")
  }
  // Campo trampa: una persona no lo ve; si viene lleno, es un bot
  if (typeof body.website === "string" && body.website.trim()) return ok()
  if (body.consent !== true) return fail("Falta aceptar la política de privacidad")

  // Solo estos campos: nadie puede elegir etapa, origen ni notas internas desde la web
  const referredBy = typeof body.referredBy === "string" ? body.referredBy : ""
  const r = parseLeadInput({ firstName: body.firstName, lastName: body.lastName, phone: body.phone, email: body.email, goal: body.goal, daysPerWeek: body.daysPerWeek, referredBy, source: referredBy.trim() ? "REFERIDO" : "WEB", notes: null })
  if ("error" in r) return fail(r.error ?? "Datos no válidos")
  const data = r.data as { firstName: string; phone: string | null; lastName: string | null; email: string | null; goal: string | null; daysPerWeek: number | null; referredBy: string | null; source: string }
  if (!data.phone) return fail("Escribe tu celular")

  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "?"
  const ipHash = createHash("sha256").update(`${process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? ""}:${ip}`).digest("hex")
  const hourAgo = new Date(Date.now() - 3_600_000), dayAgo = new Date(Date.now() - 86_400_000)
  // El hash de la conexión solo sirve para el límite: se borra a las 24 h
  await prisma.lead.updateMany({ where: { ipHash: { not: null }, createdAt: { lt: dayAgo } }, data: { ipHash: null } })
  const [mine, total] = await Promise.all([
    prisma.lead.count({ where: { ipHash, createdAt: { gte: hourAgo } } }),
    prisma.lead.count({ where: { ipHash: { not: null }, createdAt: { gte: hourAgo } } }),
  ])
  if (mine >= MAX_PER_IP_HOUR || total >= MAX_TOTAL_HOUR) return fail("Recibimos muchos envíos. Escríbenos por WhatsApp.", 429)

  // Mismo celular en 24 h: no se duplica. Solo completa lo que faltaba, y nunca pisa lo que ya había.
  const same = await prisma.lead.findFirst({ where: { phone: data.phone, stage: { notIn: ["WON", "LOST"] }, createdAt: { gte: dayAgo } }, orderBy: { createdAt: "desc" } })
  if (same) {
    if (same.stage === "NEW") {
      await prisma.lead.update({
        where: { id: same.id },
        data: { lastName: same.lastName ?? data.lastName, email: same.email ?? data.email, goal: same.goal ?? data.goal, daysPerWeek: same.daysPerWeek ?? data.daysPerWeek, referredBy: same.referredBy ?? data.referredBy, consentAt: same.consentAt ?? new Date() },
      })
    }
    return ok()
  }

  await prisma.lead.create({ data: { ...data, consentAt: new Date(), ipHash } })
  // Sin nombre ni celular: el aviso se ve en la pantalla bloqueada
  await notifyAdmin({ type: "LEAD", title: "🎯 Nuevo interesado desde la web", body: "Respóndele cuanto antes.", link: "/coaching/interesados" }).catch((e) => console.error("[leads] aviso", (e as Error).message))
  return ok()
}
