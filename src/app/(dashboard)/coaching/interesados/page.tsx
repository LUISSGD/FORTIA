import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import InteresadosClient from "./InteresadosClient"

export default async function InteresadosPage() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") redirect("/login")
  return <InteresadosClient />
}
