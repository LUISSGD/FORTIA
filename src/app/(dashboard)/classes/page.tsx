import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

// Pantalla retirada: las clases y horarios se ven en la Agenda de coaching.
export default async function RemovedPage() {
  const session = await auth()
  redirect(session?.user?.role === "USER" ? "/clients" : "/coaching/agenda")
}
