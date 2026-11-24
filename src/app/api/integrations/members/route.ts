import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { botGuard, phoneKey, toMember } from "@/lib/integrations/bot"

export const dynamic = "force-dynamic"

/** GET /api/integrations/members?phone=51987654321 — ¿este WhatsApp es de un alumno? */
export async function GET(req: Request) {
  const denied = botGuard(req)
  if (denied) return denied
  const key = phoneKey(new URL(req.url).searchParams.get("phone"))
  if (key.length < 9) return NextResponse.json({ member: null })

  const candidates = await prisma.client.findMany({
    where: { OR: [{ phone: { endsWith: key } }, { phone2: { endsWith: key } }] },
    include: { membershipPlan: true },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
  })
  const c = candidates.find((x) => phoneKey(x.phone) === key || phoneKey(x.phone2) === key)
  return NextResponse.json({ member: c ? { ...toMember(c), isActive: c.isActive } : null })
}
