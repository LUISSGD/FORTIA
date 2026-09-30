import { prisma } from "@/lib/prisma"

// Mantiene sincronizados el cliente del gimnasio (Client.isActive) y su perfil de coaching:
// - todo cliente activo del gimnasio tiene perfil de coaching (el coaching es la vista principal);
// - "Stand-by (ex cliente)" en coaching = cliente inactivo en FORTIA, y viceversa.

/** Crea el perfil de coaching si no existe (o reactiva uno finalizado si se pide). */
export async function ensureCoachingProfile(clientId: string) {
  const existing = await prisma.coachingProfile.findUnique({ where: { clientId } })
  if (existing) return existing
  return prisma.coachingProfile.create({ data: { clientId, startDate: new Date() } })
}

/** Cambia el estado de coaching de varios clientes y refleja "activo / inactivo" en FORTIA. */
export async function setCoachingStatus(clientIds: string[], status: "ACTIVE" | "PAUSED" | "STANDBY") {
  if (!clientIds.length) return 0
  const [r] = await prisma.$transaction([
    prisma.coachingProfile.updateMany({ where: { clientId: { in: clientIds }, status: { not: "ENDED" } }, data: { status } }),
    prisma.client.updateMany({ where: { id: { in: clientIds } }, data: { isActive: status !== "STANDBY" } }),
  ])
  return r.count
}

/** El cliente se dio de baja en FORTIA → pasa a stand-by en coaching. */
export async function deactivateClient(clientId: string) {
  await prisma.$transaction([
    prisma.client.update({ where: { id: clientId }, data: { isActive: false } }),
    prisma.coachingProfile.updateMany({ where: { clientId, status: { in: ["ACTIVE", "PAUSED"] } }, data: { status: "STANDBY" } }),
  ])
}
