import { redirect } from "next/navigation"

// "Acumulados" se reemplazó por el cuadro anual de Obligaciones.
export default function PendingAccumulatedPage() {
  redirect("/finances/obligaciones")
}
