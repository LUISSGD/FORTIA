import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getRenewalProjection } from "@/lib/finance/renewals"

export async function GET(req: NextRequest) {
  return NextResponse.json(await getRenewalProjection(req.nextUrl.searchParams.get("month")))
}

export async function POST(req: NextRequest) {
  const { clientId, yearMonth, skip } = await req.json() as {
    clientId: string
    yearMonth: string
    skip: boolean
  }

  if (!clientId || !yearMonth) {
    return NextResponse.json({ error: "clientId y yearMonth requeridos" }, { status: 400 })
  }

  if (skip) {
    await prisma.renewalProjectionSkip.upsert({
      where: { clientId_yearMonth: { clientId, yearMonth } },
      create: { clientId, yearMonth },
      update: {},
    })
  } else {
    await prisma.renewalProjectionSkip.deleteMany({ where: { clientId, yearMonth } })
  }

  return NextResponse.json({ ok: true })
}
