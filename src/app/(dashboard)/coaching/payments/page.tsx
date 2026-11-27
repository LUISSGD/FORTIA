import { redirect } from "next/navigation"

// Las "mensualidades de coaching online" se quitaron: los cobros del gimnasio están en Finanzas → Cobranza.
export default function CoachingPaymentsPage() {
  redirect("/finances/cobranza")
}
