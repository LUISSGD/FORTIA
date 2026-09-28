import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

/** Solo el entrenador (rol ADMIN) gestiona el módulo de coaching. */
export async function requireCoach() {
  const session = await auth()
  if (!session?.user) return { error: jsonError("No autorizado", 401) } as const
  if (session.user.role !== "ADMIN") return { error: jsonError("Sin permisos", 403) } as const
  return { session } as const
}

/** Cliente con acceso a la app. Devuelve el clientId vinculado a su usuario. */
export async function requireClient() {
  const session = await auth()
  if (!session?.user?.id) return { error: jsonError("No autorizado", 401) } as const
  if (session.user.role !== "CLIENT") return { error: jsonError("Sin permisos", 403) } as const
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { clientId: true, client: { select: { coachingProfile: { select: { status: true } } } } },
  })
  if (!user?.clientId) return { error: jsonError("Cuenta sin cliente vinculado", 403) } as const
  if (user.client?.coachingProfile?.status === "ENDED") return { error: jsonError("Tu acceso está desactivado", 403) } as const
  return { session, clientId: user.clientId } as const
}

/** Para páginas server-side de la app del cliente. */
export async function getClientSession() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "CLIENT") return null
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { clientId: true } })
  if (!user?.clientId) return null
  return { session, clientId: user.clientId }
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function str(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length ? t : null
}
