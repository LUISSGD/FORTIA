import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { deleteIncome } from "@/lib/finance-sync"

export async function DELETE(_req: Request, ctx: RouteContext<"/api/finances/income/[id]">) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await ctx.params

  // Borra también el pago del cliente (y revierte su membresía) o reabre la mensualidad de coaching.
  const r = await deleteIncome(id)
  if (!r.deleted) return NextResponse.json({ error: "Ingreso no encontrado" }, { status: 404 })
  return NextResponse.json({ ok: true, membershipReverted: r.membershipReverted })
}
