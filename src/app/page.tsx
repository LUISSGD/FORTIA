import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function HomePage() {
  const session = await auth()
  const role = session?.user?.role
  redirect(role === "CLIENT" ? "/app" : role === "USER" ? "/clients" : "/dashboard")
}
