import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type Ctx = { params: Promise<{ id: string; planId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { planId } = await params
  const { status } = await req.json()

  const plan = await prisma.clientTrainingPlan.update({
    where: { id: planId },
    data: { status },
  })
  return NextResponse.json(plan)
}
