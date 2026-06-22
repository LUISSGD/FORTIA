import Sidebar from "@/components/layout/Sidebar"
import BottomNav from "@/components/layout/BottomNav"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
