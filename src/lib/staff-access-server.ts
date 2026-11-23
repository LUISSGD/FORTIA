import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseModules, type StaffModule } from "@/lib/staff-access"

/**
 * Accesos actuales de una cuenta del staff. Se leen de la base en cada pedido (no de la sesión) para que un cambio
 * valga al instante. Si la cuenta ya no existe, dejó de ser staff o la base falla, no abre nada.
 */
export async function getStaffModules(userId: string | null | undefined): Promise<StaffModule[]> {
  if (!userId) return []
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, staffAccess: { select: { modules: true } } } })
    return user?.role === "USER" ? parseModules(user.staffAccess?.modules) : []
  } catch (e) {
    console.error("[accesos]", (e as Error).message)
    return []
  }
}

type SessionLike = { user?: { id?: string; role?: string } } | null

/** null = sin límite (administrador). Para otros roles devuelve [] salvo el staff. */
export async function getSessionModules(session: SessionLike): Promise<StaffModule[] | null> {
  if (!session?.user) return []
  if (session.user.role === "ADMIN") return null
  return session.user.role === "USER" ? getStaffModules(session.user.id) : []
}

/** Segunda barrera dentro de las APIs: ADMIN, o staff con alguno de estos módulos. Devuelve el error o null. */
export async function denyUnless(session: SessionLike, ...keys: StaffModule[]) {
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const modules = await getSessionModules(session)
  if (modules === null || keys.some((k) => modules.includes(k))) return null
  return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
}
