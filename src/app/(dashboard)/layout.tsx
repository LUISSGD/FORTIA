import Image from "next/image"
import Link from "next/link"
import TopNav from "@/components/layout/TopNav"
import BottomNav from "@/components/layout/BottomNav"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <TopNav />
      {/* Mobile-only brand header */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-100 h-12 flex items-center px-4">
        <Link href="/coaching/clients" className="flex items-center gap-2">
          <Image src="/logo.png" alt="FORTIA" width={26} height={26} className="rounded-md" />
          <span className="text-sm font-bold tracking-widest uppercase text-gray-900">
            FORTIA <span className="text-orange-500">COACHING</span>
          </span>
        </Link>
      </header>
      <div className="flex-1 min-h-0 pb-16 md:pb-0">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
