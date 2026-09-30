import TopNav from "@/components/layout/TopNav"
import BottomNav from "@/components/layout/BottomNav"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <TopNav />
      <div className="flex-1 min-h-0 pb-16 md:pb-0">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
