import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getClientSession } from "@/lib/coaching/auth"
import { formatYmd, todayYmd, weekStartYmd } from "@/lib/coaching/dates"
import { ADHERENCE_OPTIONS, ENERGY_OPTIONS, SLEEP_OPTIONS } from "@/lib/coaching/constants"
import { Card, PageTitle, SectionTitle } from "@/components/coaching/app/ui"
import CheckInForm from "@/components/coaching/app/CheckInForm"

export default async function CheckInPage() {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const weekStart = weekStartYmd(todayYmd())
  const checkIns = await prisma.checkIn.findMany({ where: { clientId: ctx.clientId }, orderBy: { weekStart: "desc" }, take: 12, include: { photos: true } })
  const current = checkIns.find((c) => c.weekStart === weekStart) ?? null

  return (
    <div className="space-y-4">
      <PageTitle title="Check-in semanal" subtitle={`Semana del ${formatYmd(weekStart)} · cuéntale a tu coach cómo te fue`} />
      <CheckInForm
        existing={current ? { id: current.id, energy: current.energy, nutritionAdherence: current.nutritionAdherence, sleep: current.sleep, stress: current.stress, weight: current.weight, discomfort: current.discomfort, feelings: current.feelings, photoCount: current.photos.length } : null}
      />
      {checkIns.filter((c) => c.weekStart !== weekStart || c.coachReply).length > 0 && (
        <div>
          <SectionTitle emoji="🗂️">Historial</SectionTitle>
          <div className="space-y-3">
            {checkIns.map((c) => (
              <Card key={c.id}>
                <p className="text-xs text-gray-400 mb-1">Semana del {formatYmd(c.weekStart, true)}</p>
                <p className="text-sm">
                  {ENERGY_OPTIONS.find((o) => o.value === c.energy)?.emoji} Energía {ENERGY_OPTIONS.find((o) => o.value === c.energy)?.label.toLowerCase()} · 🍽️ {ADHERENCE_OPTIONS.find((o) => o.value === c.nutritionAdherence)?.label} · 😴 {SLEEP_OPTIONS.find((o) => o.value === c.sleep)?.label}
                </p>
                {c.coachReply && (
                  <div className="mt-2 rounded-xl bg-orange-50 border border-orange-200 p-3">
                    <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">Tu coach</p>
                    <p className="text-sm whitespace-pre-wrap">{c.coachReply}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
