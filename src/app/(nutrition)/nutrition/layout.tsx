import Image from "next/image"
import Link from "next/link"
import NutritionNav from "./NutritionNav"

export default function NutritionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Desktop top bar */}
      <header className="hidden md:flex sticky top-0 z-50 bg-white border-b border-gray-200 h-14 items-center px-6 gap-8">
        <Link href="/nutrition" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="FORTIA" width={28} height={28} className="rounded-md" />
          <span className="text-sm font-bold tracking-widest uppercase text-gray-900">
            FORTIA <span className="text-orange-500">NUTRICIÓN</span>
          </span>
        </Link>
        <NutritionNav desktop />
      </header>
      {/* Mobile brand header */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-100 h-12 flex items-center px-4">
        <Link href="/nutrition" className="flex items-center gap-2">
          <Image src="/logo.png" alt="FORTIA" width={26} height={26} className="rounded-md" />
          <span className="text-sm font-bold tracking-widest uppercase text-gray-900">
            FORTIA <span className="text-orange-500">NUTRICIÓN</span>
          </span>
        </Link>
      </header>
      <div className="flex-1 min-h-0 pb-16 md:pb-0">
        {children}
      </div>
      {/* Mobile bottom nav */}
      <NutritionNav mobile />
    </div>
  )
}
