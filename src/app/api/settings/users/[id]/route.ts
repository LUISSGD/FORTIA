import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    if (user.role === "ADMIN") {
      return NextResponse.json({ error: "No se puede eliminar un administrador" }, { status: 403 })
    }
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
