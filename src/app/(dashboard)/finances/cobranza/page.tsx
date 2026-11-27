import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import CobranzaClient from "./CobranzaClient"

export default async function CobranzaPage({ searchParams }: PageProps<"/finances/cobranza">) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") redirect("/login")
  const { vista } = await searchParams
  return <CobranzaClient initialArea={vista === "personalizados" ? "PT" : "MEMBERSHIP"} />
}
