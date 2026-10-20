import ExpiryList from "@/components/coaching/ExpiryList"
import { requireTrainerPage } from "@/lib/coaching/auth"
import { withCoachErrors } from "@/components/coaching/withCoachErrors"

export const dynamic = "force-dynamic"

async function TrainerVencimientosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireTrainerPage()
  const sp = await searchParams
  return <ExpiryList basePath="/trainer" showStandby={sp.standby === "1"} kind={sp.ver === "programas" ? "programs" : "memberships"} />
}

export default withCoachErrors("Vencimientos", TrainerVencimientosPage)
