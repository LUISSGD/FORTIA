import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach } from "@/lib/coaching/auth"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  try {
    const { id } = await params
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    if (user.role === "ADMIN") {
      return NextResponse.json({ error: "No se puede eliminar un administrador" }, { status: 403 })
    }
    if (user.role === "CLIENT") {
      return NextResponse.json({ error: "El acceso de los clientes se gestiona en Coaching → cliente → Ajustes" }, { status: 400 })
    }
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
