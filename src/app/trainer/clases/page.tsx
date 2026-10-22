import TrainerMonth from "@/components/coaching/TrainerMonth"
import { requireTrainerPage } from "@/lib/coaching/auth"
import { withCoachErrors } from "@/components/coaching/withCoachErrors"

export const dynamic = "force-dynamic"

async function TrainerClassesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireTrainerPage()
  const sp = await searchParams
  return (
    <div className="p-4 md:p-6">
      <TrainerMonth basePath="/trainer" month={typeof sp.month === "string" ? sp.month : undefined} trainer={typeof sp.t === "string" ? sp.t : undefined} />
    </div>
  )
}

export default withCoachErrors("Clases del mes", TrainerClassesPage)
