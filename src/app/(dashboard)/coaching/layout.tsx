export default function CoachingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 p-3 md:p-6 space-y-4 md:space-y-6">
      {children}
    </main>
  )
}
