import { prisma } from "@/lib/prisma"
import { addCalendarDays, calendarDate, calendarYmd } from "@/lib/calendar"
import { diffDaysYmd, formatYmdLong, todayYmd } from "@/lib/coaching/dates"
import { normalizePhone } from "@/lib/phone"
import { whatsappUrl } from "@/lib/utils"
import { getAllBalances, RENEWAL_SELECT, renewalPrice } from "./renewals"
import { getPtPanel } from "@/lib/coaching/pt-panel"
import { balanceStep, fillMessage, nextAction, ptStep, REACTIVATE_TO, renewalStep, RENEWAL_PRE_DAYS, templateKey, TEMPLATES, type Area, type Kind, type Record_, type Step } from "./collection-rules"

// Cobranza: a quién escribir hoy por su renovación o su saldo, separada en dos vías que no se mezclan:
// - Membresías: van por la fecha de vencimiento (5 días antes, el día, y cada semana si ya venció).
// - Personalizados: van por las clases que le quedan del paquete (panel de Entrena. Personal), no por fecha. El mensaje lo envía Luis desde su WhatsApp;
// aquí solo se registra a quién ya se le escribió.

export type CollectionItem = {
  id: string
  clientId: string
  name: string
  phone: string | null
  kind: Kind
  area: Area
  step: Step
  cycleKey: string
  plan: string
  dueDate: string | null
  daysLeft: number | null
  amount: number
  standby: boolean
  /** Solo personalizados: clases que le quedan del paquete */
  classesLeft: number | null
  waUrl: string | null
}

const short = (c: { firstName: string; lastName: string }) => `${c.firstName} ${c.lastName}`.replace(/\s+/g, " ").replace(/\s\.$/, "").trim()
const soles = (n: number) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export async function getTemplates() {
  const saved = new Map((await prisma.messageTemplate.findMany()).map((t) => [t.key, t.text]))
  return TEMPLATES.map((t) => ({ ...t, text: saved.get(t.key) ?? t.text, edited: saved.has(t.key) }))
}

export async function getCollections() {
  const today = todayYmd()
  const [clients, balances, templates, pt] = await Promise.all([
    prisma.client.findMany({
      where: {
        // La 2ª persona de una pareja comparte la membresía de la ficha principal
        partnerOfId: null,
        membershipEnd: { gte: calendarDate(addCalendarDays(today, -REACTIVATE_TO - 1)), lte: calendarDate(addCalendarDays(today, RENEWAL_PRE_DAYS + 60)) },
        OR: [{ membershipPlan: { isNot: null } }, { trainingPlans: { some: {} } }],
      },
      select: {
        id: true, firstName: true, lastName: true, phone: true, isActive: true, membershipEnd: true,
        ...RENEWAL_SELECT,
        renewalSkips: { select: { yearMonth: true } },
      },
    }),
    getAllBalances(),
    getTemplates(),
    getPtPanel({ withMoney: true }),
  ])
  const balanceClients = await prisma.client.findMany({ where: { id: { in: balances.map((b) => b.clientId) } }, select: { id: true, firstName: true, lastName: true, phone: true, isActive: true } })

  const ids = [...new Set([...clients.map((c) => c.id), ...balances.map((b) => b.clientId), ...pt.rows.map((r) => r.clientId)])]
  const follow = await prisma.followUp.findMany({ where: { clientId: { in: ids } } })
  const recordsOf = (clientId: string, kind: Kind, cycleKey: string): Record_[] =>
    follow
      .filter((f) => f.clientId === clientId && f.kind === kind && f.cycleKey === cycleKey)
      .map((f) => ({ step: f.step, outcome: f.outcome, promiseYmd: f.promiseDate ? calendarYmd(f.promiseDate) : null, atYmd: calendarYmd(f.at) }))
  const textOf = new Map(templates.map((t) => [t.key, t.text]))

  const items: CollectionItem[] = []
  const waiting: { clientId: string; name: string; date: string; amount: number; area: Area }[] = []
  const add = (base: Omit<CollectionItem, "id" | "step" | "waUrl" | "phone"> & { firstName: string; phone: string | null }, natural: Exclude<Step, "PROMISE"> | null) => {
    const { firstName, ...b } = base
    const next = nextAction({ natural, records: recordsOf(b.clientId, b.kind, b.cycleKey), today })
    if (next.waiting) waiting.push({ clientId: b.clientId, name: b.name, date: next.waiting, amount: b.amount, area: b.area })
    if (!next.step) return
    const phone = normalizePhone(b.phone)
    const message = fillMessage(textOf.get(templateKey(b.kind, next.step)) ?? "", {
      nombre: firstName.trim(),
      plan: b.plan,
      fecha: b.dueDate ? formatYmdLong(b.dueDate).toLowerCase() : "los próximos días",
      monto: soles(b.amount),
      clases: b.classesLeft === null ? "" : `${b.classesLeft} ${b.classesLeft === 1 ? "clase" : "clases"}`,
    })
    items.push({ ...b, id: `${b.kind}:${b.cycleKey}:${b.clientId}`, phone, step: next.step, waUrl: phone ? whatsappUrl(phone, message) : null })
  }

  for (const c of clients) {
    const dueDate = calendarYmd(c.membershipEnd!)
    const daysLeft = diffDaysYmd(dueDate, today)
    const skipped = c.renewalSkips.some((s) => s.yearMonth === dueDate.slice(0, 7))
    const { price, planName, isTraining } = renewalPrice(c)
    // Su último plan es un paquete personalizado: se cobra por clases, en la vía de personalizados
    if (isTraining) continue
    const natural = renewalStep(daysLeft, !c.isActive || skipped)
    if (skipped && natural === null) continue
    add({ clientId: c.id, firstName: c.firstName, name: short(c), phone: c.phone, kind: "RENEWAL", area: "MEMBERSHIP", cycleKey: dueDate, plan: planName, dueDate, daysLeft, amount: price, standby: !c.isActive, classesLeft: null }, natural)
  }
  for (const r of pt.rows) {
    const natural = ptStep(r.state, r.state === "ended" && r.daysToLast !== null ? -r.daysToLast : null)
    if (!natural) continue
    add({ clientId: r.clientId, firstName: r.firstName, name: r.name, phone: r.phone, kind: "PT", area: "PT", cycleKey: r.planId, plan: r.plan, dueDate: r.last, daysLeft: r.daysToLast, amount: r.price ?? 0, standby: false, classesLeft: r.remaining }, natural)
  }
  for (const b of balances) {
    const c = balanceClients.find((x) => x.id === b.clientId)
    if (!c) continue
    const daysLeft = b.dueDate ? diffDaysYmd(b.dueDate, today) : null
    add({ clientId: c.id, firstName: c.firstName, name: short(c), phone: c.phone, kind: "BALANCE", area: b.isTraining ? "PT" : "MEMBERSHIP", cycleKey: b.paymentId, plan: b.concept.replace(/^Renovación /, ""), dueDate: b.dueDate, daysLeft, amount: b.amount, standby: !c.isActive, classesLeft: null }, balanceStep(daysLeft))
  }

  // Dentro de cada grupo, primero lo más urgente; en "reactivar", los que vencieron hace menos
  // En personalizados por terminar, primero a quien le quedan menos clases
  items.sort((a, b) => (a.kind === "PT" && b.kind === "PT" && a.step === "PRE" && b.step === "PRE" ? (a.classesLeft ?? 0) - (b.classesLeft ?? 0) : a.step === "REACTIVATE" && b.step === "REACTIVATE" ? (b.daysLeft ?? 0) - (a.daysLeft ?? 0) : (a.daysLeft ?? -999) - (b.daysLeft ?? -999)))
  waiting.sort((a, b) => a.date.localeCompare(b.date))

  const [noPhone, recent] = await Promise.all([
    prisma.client.findMany({ where: { isActive: true, partnerOfId: null }, select: { id: true, firstName: true, lastName: true, phone: true }, orderBy: { firstName: "asc" } }),
    prisma.followUp.findMany({ where: { at: { gte: new Date(Date.now() - 3 * 86_400_000) } }, orderBy: { at: "desc" }, take: 30, include: { client: { select: { firstName: true, lastName: true } } } }),
  ])

  return {
    today,
    items,
    waiting,
    templates,
    totalActive: noPhone.length,
    noPhone: noPhone.filter((c) => !normalizePhone(c.phone)).map((c) => ({ id: c.id, name: short(c), phone: c.phone ?? "" })),
    recent: recent.map((f) => ({ id: f.id, name: short(f.client), step: f.step, kind: f.kind, outcome: f.outcome, at: calendarYmd(f.at), by: f.createdByName })),
  }
}
