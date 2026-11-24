import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { calendarDate } from "@/lib/calendar"
import { addDaysYmd, todayYmd } from "@/lib/coaching/dates"
import { botGuard, toMember } from "@/lib/integrations/bot"

export const dynamic = "force-dynamic"

/** GET /api/integrations/renewals?from=-3&to=7 — alumnos activos que vencen entre hoy+from y hoy+to (días de Lima). */
export async function GET(req: Request) {
  const denied = botGuard(req)
  if (denied) return denied
  const sp = new URL(req.url).searchParams
  const from = Math.max(-60, Math.min(60, Math.trunc(Number(sp.get("from") ?? -3)) || 0))
  const to = Math.max(from, Math.min(60, Math.trunc(Number(sp.get("to") ?? 7)) || 0))
  const today = todayYmd()

  const clients = await prisma.client.findMany({
    where: {
      isActive: true,
      phone: { not: null },
      // Las parejas comparten la membresía de la ficha principal: se avisa solo a esa
      partnerOfId: null,
      membershipEnd: { gte: calendarDate(addDaysYmd(today, from)), lte: calendarDate(addDaysYmd(today, to)) },
    },
    include: { membershipPlan: true, trainingPlans: { where: { status: { in: ["ACTIVE", "PAUSED"] } }, select: { id: true } } },
    orderBy: { membershipEnd: "asc" },
  })
  return NextResponse.json({
    today,
    members: clients.map((c) => ({
      ...toMember(c),
      // Alumno de entrenamiento personal: su membresía sigue al paquete de clases, no a un plan con link de pago
      personalTraining: c.trainingPlans.length > 0,
    })),
  })
}
