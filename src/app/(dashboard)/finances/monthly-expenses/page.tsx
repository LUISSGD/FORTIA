import Header from "@/components/layout/Header"
import MonthlyExpensesClient from "./MonthlyExpensesClient"

export default function MonthlyExpensesPage() {
  return (
    <>
      <Header title="Gastos Corrientes" />
      <MonthlyExpensesClient />
    </>
  )
}
