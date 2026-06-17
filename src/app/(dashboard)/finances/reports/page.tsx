import Header from "@/components/layout/Header"
import ReportChartWrapper from "./ReportChartWrapper"

export default function ReportsPage() {
  return (
    <>
      <Header title="Reportes financieros" />
      <main className="flex-1 p-6">
        <h2 className="text-xl font-semibold mb-6">Ingresos vs Egresos — últimos 6 meses</h2>
        <div className="bg-white rounded-lg border p-6">
          <ReportChartWrapper />
        </div>
      </main>
    </>
  )
}
