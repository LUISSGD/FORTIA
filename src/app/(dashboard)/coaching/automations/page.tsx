import { prisma } from "@/lib/prisma"
import { ensureAutomationRules, AUTOMATION_DEFAULTS } from "@/lib/coaching/automations"
import { dateTimeLima } from "@/lib/coaching/dates"
import { Panel } from "@/components/coaching/kit"
import AutomationsEditor from "./AutomationsEditor"

export const dynamic = "force-dynamic"

export default async function AutomationsPage() {
  const rules = await ensureAutomationRules()
  const logs = await prisma.automationLog.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { rule: { select: { type: true } }, client: { select: { firstName: true, lastName: true } } } })
  const order = Object.keys(AUTOMATION_DEFAULTS)
  return (
    <>
      <div>
        <h1 className="text-xl font-bold">Automatizaciones</h1>
        <p className="text-sm text-gray-500">
          Mensajes y recordatorios automáticos. Se ejecutan una vez al día (cron) y también puedes lanzarlos manualmente. Nunca se envía dos veces el mismo aviso.
          Variables: <code className="text-xs bg-gray-100 px-1 rounded">{"{nombre}"}</code> <code className="text-xs bg-gray-100 px-1 rounded">{"{dias}"}</code> <code className="text-xs bg-gray-100 px-1 rounded">{"{entrenos}"}</code> <code className="text-xs bg-gray-100 px-1 rounded">{"{entreno}"}</code> <code className="text-xs bg-gray-100 px-1 rounded">{"{hora}"}</code> <code className="text-xs bg-gray-100 px-1 rounded">{"{monto}"}</code> <code className="text-xs bg-gray-100 px-1 rounded">{"{fecha}"}</code>
        </p>
      </div>
      <AutomationsEditor
        rules={[...rules].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type)).map((r) => ({ id: r.id, type: r.type, enabled: r.enabled, days: r.days, channel: r.channel, message: r.message, label: AUTOMATION_DEFAULTS[r.type]?.label ?? r.type, description: AUTOMATION_DEFAULTS[r.type]?.description ?? "", hasDays: AUTOMATION_DEFAULTS[r.type]?.days !== null }))}
      />
      <Panel title="Últimos envíos automáticos">
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no se envió nada.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="py-1.5 flex justify-between gap-2">
                <span>{AUTOMATION_DEFAULTS[l.rule.type]?.label ?? l.rule.type} → {l.client.firstName} {l.client.lastName}</span>
                <span className="text-xs text-gray-400">{dateTimeLima(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
