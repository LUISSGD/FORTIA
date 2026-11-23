import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { buildStaffToday } from "@/lib/coaching/digest"
import { getSessionModules } from "@/lib/staff-access-server"
import StaffToday from "@/components/coaching/StaffToday"

export const dynamic = "force-dynamic"

/** "Hoy" del staff. El administrador tiene el suyo, completo, en Coaching. */
export default async function StaffHoyPage() {
  const modules = await getSessionModules(await auth())
  if (!modules) redirect("/coaching/hoy")
  if (!modules.includes("today")) redirect("/")
  return <StaffToday d={await buildStaffToday()} linkClients={modules.includes("clients")} />
}
