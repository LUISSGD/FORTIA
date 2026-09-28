import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { requireClient, jsonError, str } from "@/lib/coaching/auth"

export async function POST(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const b = await request.json()
  const current = str(b.current)
  const next = str(b.next)
  if (!current || !next || next.length < 6) return jsonError("La nueva contraseña debe tener al menos 6 caracteres")
  const user = await prisma.user.findUnique({ where: { id: guard.session.user.id } })
  if (!user || !(await bcrypt.compare(current, user.password))) return jsonError("Contraseña actual incorrecta")
  await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(next, 10) } })
  return NextResponse.json({ ok: true })
}
