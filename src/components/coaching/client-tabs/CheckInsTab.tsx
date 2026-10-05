import { prisma } from "@/lib/prisma"
import { formatYmd } from "@/lib/coaching/dates"
import { ADHERENCE_OPTIONS, SLEEP_OPTIONS, ENERGY_OPTIONS } from "@/lib/coaching/constants"
import { Panel } from "@/components/coaching/kit"
import LineChartCard from "@/components/coaching/LineChartCard"
import CheckInReview from "./CheckInReview"

/** Pestaña "Check-ins": respuestas semanales del cliente y respuesta del coach o entrenador. */
export default async function CheckInsTab({ clientId }: { clientId: string }) {
  const checkIns = await prisma.checkIn.findMany({ where: { clientId }, orderBy: { weekStart: "desc" }, include: { photos: true } })
  if (!checkIns.length) return <Panel><p className="text-sm text-gray-500 text-center py-6">El cliente aún no envió check-ins. Se le recuerda automáticamente los domingos.</p></Panel>
  const energySeries = [...checkIns].reverse().map((c) => ({ label: formatYmd(c.weekStart), value: c.energy }))
  return (
    <div className="space-y-4">
      <Panel title="Energía semanal (1–5)"><LineChartCard data={energySeries} height={160} color="#8b5cf6" /></Panel>
      {checkIns.map((c) => (
        <Panel key={c.id} title={`Semana del ${formatYmd(c.weekStart, true)}`} action={c.reviewedAt ? <span className="text-xs text-emerald-600">✅ Revisado</span> : <span className="text-xs text-amber-600">Pendiente de revisión</span>}>
          <div className="grid md:grid-cols-2 gap-4">
            <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
              <dt className="text-gray-500">Energía</dt><dd>{ENERGY_OPTIONS.find((o) => o.value === c.energy)?.emoji} {ENERGY_OPTIONS.find((o) => o.value === c.energy)?.label}</dd>
              <dt className="text-gray-500">Alimentación</dt><dd>{ADHERENCE_OPTIONS.find((o) => o.value === c.nutritionAdherence)?.label}</dd>
              <dt className="text-gray-500">Sueño</dt><dd>{SLEEP_OPTIONS.find((o) => o.value === c.sleep)?.label}</dd>
              {c.stress && (<><dt className="text-gray-500">Estrés</dt><dd>{c.stress}/5</dd></>)}
              {c.weight && (<><dt className="text-gray-500">Peso</dt><dd>{c.weight} kg</dd></>)}
              {c.discomfort && (<><dt className="text-gray-500">Molestias</dt><dd className="text-red-600">{c.discomfort}</dd></>)}
              {c.feelings && (<><dt className="text-gray-500 col-span-2">¿Cómo se sintió?</dt><dd className="col-span-2 bg-gray-50 rounded p-2">{c.feelings}</dd></>)}
            </dl>
            <div className="space-y-2">
              {c.photos.length > 0 && (
                <div className="flex gap-2">
                  {c.photos.map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.pose} className="h-24 w-20 object-cover rounded-lg" /></a>
                  ))}
                </div>
              )}
              <CheckInReview id={c.id} reply={c.coachReply} reviewed={!!c.reviewedAt} />
            </div>
          </div>
        </Panel>
      ))}
    </div>
  )
}
