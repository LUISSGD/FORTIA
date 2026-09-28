import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireClient } from "@/lib/coaching/auth"

export async function PATCH() {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  await prisma.notification.updateMany({ where: { clientId: guard.clientId, audience: "CLIENT", readAt: null }, data: { readAt: new Date() } })
  return NextResponse.json({ ok: true })
}
