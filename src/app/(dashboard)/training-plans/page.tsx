import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getSessionModules } from "@/lib/staff-access-server"
import { getPtPanel } from "@/lib/coaching/pt-panel"
import PtPanel from "@/components/coaching/PtPanel"
import { withCoachErrors } from "@/components/coaching/withCoachErrors"

export const dynamic = "force-dynamic"

// Clases personalizadas por alumno y entrenador. El staff con acceso lo ve sin montos ni seguimiento de cobranza.
async function TrainingPlansPage({ searchParams }: PageProps<"/training-plans">) {
  const session = await auth()
  const modules = await getSessionModules(session)
  const isAdmin = modules === null
  if (!isAdmin && !modules.includes("training")) redirect("/sin-acceso")
  const { entrenador } = await searchParams
  const data = await getPtPanel({ withMoney: isAdmin })
  return (
    <main className="flex-1 p-3 pb-24 md:p-6">
      <PtPanel rows={data.rows} trainers={data.trainers} withMoney={isAdmin} initialTrainer={typeof entrenador === "string" ? entrenador : null} />
    </main>
  )
}

export default withCoachErrors("Clases personalizadas", TrainingPlansPage)
