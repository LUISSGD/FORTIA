import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { requireCoach } from "@/lib/coaching/auth"
import { DEFAULT_STAFF_MODULES } from "@/lib/staff-access"

export async function POST(request: Request) {
  // Solo el administrador gestiona usuarios del staff.
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  try {
    const { name, email, password, role: rawRole } = await request.json()
    const role = rawRole === "NUTRITIONIST" ? "NUTRITIONIST" : rawRole === "TRAINER" ? "TRAINER" : "USER"

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    return NextResponse.json({ ...user, modules: role === "USER" ? DEFAULT_STAFF_MODULES : null }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
