import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach } from "@/lib/coaching/auth"

export async function GET() {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  return NextResponse.json(
    await prisma.notification.findMany({ where: { audience: "COACH" }, orderBy: { createdAt: "desc" }, take: 50 })
  )
}

export async function PATCH() {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  await prisma.notification.updateMany({ where: { audience: "COACH", readAt: null }, data: { readAt: new Date() } })
  return NextResponse.json({ ok: true })
}
