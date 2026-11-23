import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach } from "@/lib/coaching/auth"
import { cleanModules, isModuleList } from "@/lib/staff-access"

/** Cambia las pantallas que puede abrir una cuenta del staff. No cambia roles ni toca otras cuentas. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!isModuleList(body?.modules)) return NextResponse.json({ error: "Accesos no válidos" }, { status: 400 })
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } })
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  if (user.role !== "USER") return NextResponse.json({ error: "Solo se cambian los accesos de las cuentas del staff" }, { status: 403 })
  const modules = cleanModules(body.modules)
  const data = { modules: modules.join(","), updatedByName: guard.session.user.name ?? null }
  await prisma.staffAccess.upsert({ where: { userId: id }, create: { userId: id, ...data }, update: data })
  return NextResponse.json({ modules })
}

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
