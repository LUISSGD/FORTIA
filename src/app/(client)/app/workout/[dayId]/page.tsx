import { notFound, redirect } from "next/navigation"
import { getClientSession } from "@/lib/coaching/auth"
import { loadWorkoutDay } from "@/lib/coaching/workout-day"
import WorkoutPlayer from "@/components/coaching/app/WorkoutPlayer"

export default async function WorkoutPage({ params }: PageProps<"/app/workout/[dayId]">) {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const { dayId } = await params
  const day = await loadWorkoutDay(ctx.clientId, dayId)
  if (!day) notFound()
  return <WorkoutPlayer {...day} />
}
