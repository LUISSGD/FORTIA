import Image from "next/image"
import Link from "next/link"
import NutritionNav from "./NutritionNav"

export default function NutritionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Desktop header */}
      <header className="hidden md:flex sticky top-0 z-50 bg-white border-b border-gray-100 h-16 items-center px-6 gap-8 shadow-sm">
        <Link href="/nutrition" className="flex items-center gap-3 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center shadow-sm">
            <Image src="/logo.png" alt="FORTIA" width={20} height={20} className="rounded-sm brightness-0 invert" />
          </div>
          <div className="leading-tight">
            <span className="text-xs font-semibold tracking-widest uppercase text-gray-400 block">FORTIA</span>
            <span className="text-sm font-bold text-orange-500 block -mt-0.5">NUTRICIÓN</span>
          </div>
        </Link>
        <NutritionNav desktop />
      </header>

      {/* Mobile brand header */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-100 h-14 flex items-center px-4 shadow-sm">
        <Link href="/nutrition" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <Image src="/logo.png" alt="FORTIA" width={18} height={18} className="rounded-sm brightness-0 invert" />
          </div>
          <div className="leading-tight">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-gray-400 block">FORTIA</span>
            <span className="text-sm font-bold text-orange-500 block -mt-0.5">NUTRICIÓN</span>
          </div>
        </Link>
      </header>

      <div className="flex-1 min-h-0 pb-20 md:pb-0">
        {children}
      </div>

      {/* Mobile bottom nav */}
      <NutritionNav mobile />
    </div>
  )
}
