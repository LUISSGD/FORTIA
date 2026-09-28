import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach } from "@/lib/coaching/auth"

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  await prisma.coachDocument.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
