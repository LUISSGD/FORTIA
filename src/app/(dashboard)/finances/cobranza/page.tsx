import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import CobranzaClient from "./CobranzaClient"

export default async function CobranzaPage() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") redirect("/login")
  return <CobranzaClient />
}
