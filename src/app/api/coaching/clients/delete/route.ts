import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError } from "@/lib/coaching/auth"

/**
 * Elimina clientes por completo (ficha, coaching, rutinas, registros, pagos, clases EP y acceso a la app).
 * Los ingresos de Finanzas se conservan sin cliente, para que los meses pasados no cambien.
 * Lo demás (perfil de coaching, registros, chat, etc.) se borra en cascada desde la base.
 */
export async function POST(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body.clientIds) ? body.clientIds.filter((x: unknown): x is string => typeof x === "string") : []
  if (!ids.length) return jsonError("Selecciona al menos un cliente")
  if (body.confirm !== "ELIMINAR") return jsonError("Escribe ELIMINAR para confirmar")

  const where = { clientId: { in: ids } }
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.income.updateMany({ where, data: { clientId: null } })
    await tx.payment.deleteMany({ where })
    await tx.enrollment.deleteMany({ where })
    await tx.trainingSession.deleteMany({ where: { plan: where } })
    await tx.clientTrainingPlan.deleteMany({ where })
    const r = await tx.client.deleteMany({ where: { id: { in: ids } } })
    return r.count
  })
  return NextResponse.json({ deleted })
}
