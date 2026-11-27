import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError } from "@/lib/coaching/auth"
import { calendarDate } from "@/lib/calendar"
import { todayYmd } from "@/lib/coaching/dates"
import { getCollections } from "@/lib/finance/collections"
import { TEMPLATES } from "@/lib/finance/collection-rules"
import { normalizePhone } from "@/lib/phone"

const YMD = /^\d{4}-\d{2}-\d{2}$/
const STEPS = ["PRE", "DUE", "LATE", "REACTIVATE", "PROMISE"]
const str = (v: unknown) => (typeof v === "string" ? v : "")

export async function GET() {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  return NextResponse.json(await getCollections())
}

export async function POST(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const body = await request.json().catch(() => ({}))

  switch (body.action) {
    // Registra que ya se le escribió (SENT), que prometió pagar (PROMISED) o que no se le escriba más (DISMISSED)
    case "record": {
      const clientId = str(body.clientId), cycleKey = str(body.cycleKey)
      const { kind, step, outcome } = body
      if (!clientId || !cycleKey || !["RENEWAL", "BALANCE", "PT"].includes(kind) || !STEPS.includes(step) || !["SENT", "PROMISED", "DISMISSED"].includes(outcome)) return jsonError("Datos no válidos")
      const promise = outcome === "PROMISED" ? str(body.promiseDate) : ""
      if (outcome === "PROMISED" && (!YMD.test(promise) || promise <= todayYmd())) return jsonError("Elige una fecha futura para la promesa de pago")
      const data = { outcome, promiseDate: promise ? calendarDate(promise) : null, createdByName: guard.session.user.name ?? null, at: new Date() }
      await prisma.followUp.upsert({
        where: { clientId_kind_step_cycleKey: { clientId, kind, step, cycleKey } },
        create: { clientId, kind, step, cycleKey, ...data },
        update: data,
      })
      return NextResponse.json({ ok: true })
    }

    case "undo": {
      await prisma.followUp.deleteMany({ where: { id: str(body.id) } })
      return NextResponse.json({ ok: true })
    }

    // Mismo dato que el botón "No renueva" de la Proyección
    case "noRenew": {
      const clientId = str(body.clientId), yearMonth = str(body.dueDate).slice(0, 7)
      if (!clientId || !/^\d{4}-\d{2}$/.test(yearMonth)) return jsonError("Datos no válidos")
      await prisma.renewalProjectionSkip.upsert({ where: { clientId_yearMonth: { clientId, yearMonth } }, create: { clientId, yearMonth }, update: {} })
      return NextResponse.json({ ok: true })
    }

    case "setPhone": {
      const phone = normalizePhone(str(body.phone))
      if (!phone) return jsonError("Celular no válido: 9 dígitos que empiezan con 9, o + y código de país")
      await prisma.client.update({ where: { id: str(body.clientId) }, data: { phone } })
      return NextResponse.json({ phone })
    }

    // Texto vacío = volver al mensaje de fábrica
    case "setTemplate": {
      const key = str(body.key), text = str(body.text).trim().slice(0, 600)
      if (!TEMPLATES.some((t) => t.key === key)) return jsonError("Mensaje no válido")
      if (text) await prisma.messageTemplate.upsert({ where: { key }, create: { key, text }, update: { text } })
      else await prisma.messageTemplate.deleteMany({ where: { key } })
      return NextResponse.json({ ok: true })
    }
  }
  return jsonError("Acción no válida")
}
