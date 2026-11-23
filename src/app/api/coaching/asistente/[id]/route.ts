import { NextResponse } from "next/server"
import { jsonError, requireCoach } from "@/lib/coaching/auth"
import { deleteConversation, loadConversation, toTurns } from "@/lib/assistant/store"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_: Request, { params }: Ctx) {
  const { error, session } = await requireCoach()
  if (error) return error
  const c = await loadConversation((await params).id, session.user.id!)
  if (!c) return jsonError("Esa conversación ya no existe", 404)
  return NextResponse.json({ id: c.id, title: c.title, turns: await toTurns(c.history) })
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { error, session } = await requireCoach()
  if (error) return error
  await deleteConversation((await params).id, session.user.id!)
  return NextResponse.json({ ok: true })
}
