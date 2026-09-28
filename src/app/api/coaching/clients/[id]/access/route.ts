import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError, str } from "@/lib/coaching/auth"

type Params = { params: Promise<{ id: string }> }

/** Crea o actualiza el acceso del cliente a la app (email + contraseña). */
export async function POST(request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id: clientId } = await params
  const body = await request.json()
  const email = str(body.email)?.toLowerCase()
  const password = str(body.password)
  if (!email) return jsonError("Email obligatorio")

  const client = await prisma.client.findUnique({ where: { id: clientId }, include: { user: true } })
  if (!client) return jsonError("Cliente no encontrado", 404)

  const taken = await prisma.user.findUnique({ where: { email } })
  if (taken && taken.clientId !== clientId) return jsonError("Ese email ya está en uso")

  if (client.user) {
    if (password && password.length < 6) return jsonError("La contraseña debe tener al menos 6 caracteres")
    const user = await prisma.user.update({
      where: { id: client.user.id },
      data: { email, ...(password ? { password: await bcrypt.hash(password, 10) } : {}) },
    })
    return NextResponse.json({ id: user.id, email: user.email })
  }

  if (!password || password.length < 6) return jsonError("La contraseña debe tener al menos 6 caracteres")
  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 10),
      name: `${client.firstName} ${client.lastName}`,
      role: "CLIENT",
      clientId,
    },
  })
  if (!client.email) await prisma.client.update({ where: { id: clientId }, data: { email } })
  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id: clientId } = await params
  await prisma.user.deleteMany({ where: { clientId, role: "CLIENT" } })
  return NextResponse.json({ ok: true })
}
