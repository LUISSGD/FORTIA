import Image from "next/image"
import Link from "next/link"
import TopNav from "@/components/layout/TopNav"
import BottomNav from "@/components/layout/BottomNav"
import StaffBottomNav from "@/components/layout/StaffBottomNav"
import { auth } from "@/lib/auth"
import { staffHome } from "@/lib/staff-access"
import { getStaffModules } from "@/lib/staff-access-server"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const staff = session?.user?.role === "USER" ? await getStaffModules(session.user.id) : null
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <TopNav staffModules={staff} />
      {/* Mobile-only brand header */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-100 h-12 flex items-center px-4">
        <Link href={staff ? staffHome(staff) : "/coaching/clients"} className="flex items-center gap-2">
          <Image src="/logo.png" alt="FORTIA" width={26} height={26} className="rounded-md" />
          <span className="text-sm font-bold tracking-widest uppercase text-gray-900">
            FORTIA {!staff && <span className="text-orange-500">COACHING</span>}
          </span>
        </Link>
      </header>
      <div className="flex-1 min-h-0 pb-16 md:pb-0">
        {children}
      </div>
      {staff ? <StaffBottomNav modules={staff} name={session?.user?.name ?? null} email={session?.user?.email ?? null} /> : <BottomNav />}
    </div>
  )
}
