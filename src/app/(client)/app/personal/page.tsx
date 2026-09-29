import { redirect } from "next/navigation"
import { getClientSession } from "@/lib/coaching/auth"
import { formatYmd } from "@/lib/coaching/dates"
import { getMembership, getPersonalTraining } from "@/lib/coaching/personal-training"
import { Card, PageTitle, SectionTitle } from "@/components/coaching/app/ui"
import PtCheckIn from "@/components/coaching/app/PtCheckIn"
import MembershipCard from "@/components/coaching/app/MembershipCard"

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

export default async function PersonalPage() {
  const ctx = await getClientSession()
  if (!ctx) redirect("/login")
  const [membership, pt] = await Promise.all([getMembership(ctx.clientId), getPersonalTraining(ctx.clientId)])

  return (
    <div className="space-y-4">
      <PageTitle title="Mi plan" subtitle="Tu membresía y tus clases personalizadas" back="/app" />

      {membership && <MembershipCard m={membership} />}

      <Card>
        <SectionTitle emoji="🏋️">Entrenamiento personal</SectionTitle>
        {pt ? <PtCheckIn initial={pt} /> : <p className="text-sm text-zinc-400">No tienes un paquete de clases personalizadas activo.</p>}
      </Card>

      {pt && pt.schedule.length > 0 && (
        <Card>
          <SectionTitle emoji="🗓️">Tu horario</SectionTitle>
          <div className="space-y-1.5">
            {pt.schedule.map((s, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="font-semibold">{DAYS[s.dayOfWeek]}</span>
                <span className="text-zinc-400">{s.startTime} – {s.endTime}</span>
              </div>
            ))}
          </div>
          {pt.upcoming.length > 0 && <p className="text-xs text-zinc-500 mt-3">Próximas: {pt.upcoming.map((d) => formatYmd(d)).join(" · ")}</p>}
        </Card>
      )}

      {pt && (
        <Card>
          <SectionTitle emoji="✅">Clases asistidas</SectionTitle>
          {pt.attended.length === 0 ? (
            <p className="text-sm text-zinc-400">Aún no hay clases registradas en este paquete.</p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {pt.attended.map((s, i) => (
                <div key={s.id} className="flex justify-between py-2 text-sm">
                  <span>Clase {pt.attended.length - i}</span>
                  <span className="text-zinc-400">{formatYmd(s.date, true)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-zinc-500 mt-3">Paquete iniciado el {formatYmd(pt.startedAt, true)}</p>
        </Card>
      )}
    </div>
  )
}
