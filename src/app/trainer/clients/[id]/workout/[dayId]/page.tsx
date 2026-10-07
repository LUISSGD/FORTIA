import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireTrainerPage } from "@/lib/coaching/auth"
import { loadWorkoutDay } from "@/lib/coaching/workout-day"
import WorkoutPlayer from "@/components/coaching/app/WorkoutPlayer"

export const dynamic = "force-dynamic"

/** El entrenador registra la sesión del cliente en su clase con el mismo reproductor de la app. */
export default async function TrainerWorkoutPage({ params }: PageProps<"/trainer/clients/[id]/workout/[dayId]">) {
  await requireTrainerPage()
  const { id, dayId } = await params
  const [client, day] = await Promise.all([
    prisma.client.findUnique({ where: { id }, select: { firstName: true, lastName: true } }),
    loadWorkoutDay(id, dayId),
  ])
  if (!client || !day) notFound()
  return (
    <div className="max-w-xl mx-auto px-4 pt-2">
      <WorkoutPlayer {...day} trainer={{ clientId: id, clientName: `${client.firstName.trim()} ${client.lastName.trim()}`.replace(/\s+\.$/, "") }} />
    </div>
  )
}
