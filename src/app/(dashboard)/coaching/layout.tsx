import Header from "@/components/layout/Header"
import CoachingNav from "@/components/coaching/CoachingNav"

export default function CoachingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header title="FORTIA Coaching" />
      <CoachingNav />
      <main className="flex-1 p-3 md:p-6 space-y-4 md:space-y-6">{children}</main>
    </>
  )
}
