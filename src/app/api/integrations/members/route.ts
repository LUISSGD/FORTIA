import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { botGuard, phoneKey, RENEWAL_INCLUDE, renewalInfo, toMember } from "@/lib/integrations/bot"

export const dynamic = "force-dynamic"

/** GET /api/integrations/members?phone=51987654321 — ¿este WhatsApp es de un alumno? */
export async function GET(req: Request) {
  const denied = botGuard(req)
  if (denied) return denied
  const key = phoneKey(new URL(req.url).searchParams.get("phone"))
  if (key.length < 9) return NextResponse.json({ member: null })

  const candidates = await prisma.client.findMany({
    where: { OR: [{ phone: { endsWith: key } }, { phone2: { endsWith: key } }] },
    include: { membershipPlan: true, ...RENEWAL_INCLUDE },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
  })
  const c = candidates.find((x) => phoneKey(x.phone) === key || phoneKey(x.phone2) === key)
  if (!c) return NextResponse.json({ member: null })
  const r = renewalInfo(c)
  // Monto de la renovación = el de Cobranza (último pago o precio del plan)
  return NextResponse.json({ member: { ...toMember(c), isActive: c.isActive, renewalPrice: r.price, renewalPlanName: r.planName, personalTraining: r.personalTraining } })
}
