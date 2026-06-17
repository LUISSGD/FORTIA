import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function DELETE(_req: Request, ctx: RouteContext<"/api/finances/expenses/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params
  await prisma.expense.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
