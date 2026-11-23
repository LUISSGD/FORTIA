import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { buildDigest } from "@/lib/coaching/digest"
import TodayDigest from "@/components/coaching/TodayDigest"
import { withCoachErrors } from "@/components/coaching/withCoachErrors"

export const dynamic = "force-dynamic"

async function HoyPage() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") redirect("/login")
  return <TodayDigest d={await buildDigest()} />
}

export default withCoachErrors("Hoy", HoyPage)
