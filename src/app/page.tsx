import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { staffHome } from "@/lib/staff-access"
import { getStaffModules } from "@/lib/staff-access-server"

export default async function HomePage() {
  const session = await auth()
  const role = session?.user?.role
  if (role === "USER") redirect(staffHome(await getStaffModules(session?.user?.id)))
  redirect(role === "CLIENT" ? "/app" : "/dashboard")
}
