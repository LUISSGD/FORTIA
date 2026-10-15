import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError } from "@/lib/coaching/auth"
import { ensureCoachingProfile } from "@/lib/coaching/lifecycle"

type Ctx = { params: Promise<{ id: string }> }

/** Convierte al interesado de la clase de prueba en cliente de FORTIA (solo admin). */
export async function POST(_request: Request, { params }: Ctx) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { id } = await params
  const trial = await prisma.trialClass.findUnique({ where: { id } })
  if (!trial) return jsonError("Clase de prueba no encontrada", 404)
  if (trial.clientId) return NextResponse.json({ clientId: trial.clientId })

  // El DNI es único: si ya pertenece a otro cliente, no se repite
  const dniTaken = trial.dni ? await prisma.client.findFirst({ where: { OR: [{ dni: trial.dni }, { dni2: trial.dni }] }, select: { id: true } }) : null
  const client = await prisma.client.create({
    data: {
      firstName: trial.firstName,
      lastName: trial.lastName ?? "",
      phone: trial.phone,
      email: trial.email,
      dni: dniTaken ? null : trial.dni,
      trainer: trial.trainer,
      notes: [`Vino a clase de prueba el ${trial.trialDate.toISOString().slice(0, 10).split("-").reverse().join("/")}.`, trial.goal ? `Objetivo: ${trial.goal}.` : null, trial.notes].filter(Boolean).join(" "),
    },
  })
  await ensureCoachingProfile(client.id)
  if (trial.goal) await prisma.coachingProfile.update({ where: { clientId: client.id }, data: { goal: trial.goal } })
  await prisma.trialClass.update({ where: { id }, data: { clientId: client.id, status: trial.status === "SCHEDULED" ? "ATTENDED" : trial.status } })
  return NextResponse.json({ clientId: client.id }, { status: 201 })
}
