import Header from "@/components/layout/Header"
import ReportChartWrapper from "./ReportChartWrapper"
import ExcelReportDownloader from "./ExcelReportDownloader"

export default function ReportsPage() {
  return (
    <>
      <Header title="Reportes financieros" />
      <main className="flex-1 p-6 space-y-6">
        <ExcelReportDownloader />
        <div>
          <h2 className="text-xl font-semibold mb-4">Ingresos vs Egresos — últimos 6 meses</h2>
          <div className="bg-white rounded-lg border p-6">
            <ReportChartWrapper />
          </div>
        </div>
      </main>
    </>
  )
}
