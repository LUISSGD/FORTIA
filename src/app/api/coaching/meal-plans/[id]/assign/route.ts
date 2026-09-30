import { NextResponse } from "next/server"
import { requireNutritionist, jsonError, str } from "@/lib/coaching/auth"
import { notifyClient } from "@/lib/coaching/notify"
import { copyMealPlan } from "../../shared"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const guard = await requireNutritionist()
  if ("error" in guard) return guard.error
  const { id } = await params
  const body = await request.json()
  const clientIds: string[] = Array.isArray(body.clientIds) ? body.clientIds : [str(body.clientId)].filter(Boolean) as string[]
  if (!clientIds.length) return jsonError("Selecciona al menos un cliente")
  const created = []
  for (const clientId of clientIds) {
    const plan = await copyMealPlan(id, { clientId, isTemplate: false })
    if (!plan) return jsonError("Plan no encontrado", 404)
    await notifyClient(clientId, { type: "NUTRITION", title: "Nuevo plan de alimentación", body: plan.name, link: "/app/nutrition" })
    created.push(plan)
  }
  return NextResponse.json(created, { status: 201 })
}
