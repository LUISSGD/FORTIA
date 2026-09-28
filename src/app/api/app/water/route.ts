import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireClient, jsonError, num } from "@/lib/coaching/auth"
import { todayYmd } from "@/lib/coaching/dates"

async function total(clientId: string, date: string) {
  const agg = await prisma.waterLog.aggregate({ where: { clientId, date }, _sum: { ml: true } })
  return agg._sum.ml ?? 0
}

export async function POST(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const ml = Math.round(num((await request.json()).ml) ?? 250)
  if (ml <= 0 || ml > 3000) return jsonError("Cantidad inválida")
  const date = todayYmd()
  await prisma.waterLog.create({ data: { clientId: guard.clientId, date, ml } })
  return NextResponse.json({ total: await total(guard.clientId, date) })
}

/** Deshace el último registro de agua de hoy. */
export async function DELETE() {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const date = todayYmd()
  const last = await prisma.waterLog.findFirst({ where: { clientId: guard.clientId, date }, orderBy: { createdAt: "desc" } })
  if (last) await prisma.waterLog.delete({ where: { id: last.id } })
  return NextResponse.json({ total: await total(guard.clientId, date) })
}
