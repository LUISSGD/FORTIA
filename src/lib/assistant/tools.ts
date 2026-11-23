import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { addCalendarDays, calendarYmd } from "@/lib/calendar"
import { todayYmd, toYmd, weekdayYmd } from "@/lib/coaching/dates"
import { buildDigest } from "@/lib/coaching/digest"
import { getClientsOverview } from "@/lib/coaching/stats"
import { getLeads } from "@/lib/coaching/leads"
import { STAGE_LABEL, SOURCE_LABEL } from "@/lib/coaching/lead-rules"
import { getClassesBetween } from "@/lib/coaching/trainer-month"
import { programDates } from "@/lib/coaching/program-dates"
import { estimate1RM, formatSet } from "@/lib/coaching/workout"
import { trainingPlanName } from "@/lib/training-pricing"
import { hasValidPhone, normalizePhone } from "@/lib/phone"
import { whatsappUrl, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/lib/utils"
import { getCollections } from "@/lib/finance/collections"
import { getAllBalances, getRenewalProjection } from "@/lib/finance/renewals"

// Lo que el asistente puede consultar. Reglas:
// - SOLO LECTURA: ninguna función escribe en la base ni envía nada.
// - Nunca devuelven celular, correo, DNI, fecha de nacimiento, lesiones, peso, medidas, fotos, check-ins,
//   chats ni notas. Para escribirle a alguien, el celular lo pone el servidor al armar el botón de WhatsApp.

export type Draft = { kind: "whatsapp"; name: string; text: string; url: string | null; href: string }
type ToolOutput = { data: unknown; draft?: Draft }
type ToolDef<S extends z.ZodType = z.ZodType> = { name: string; label: string; description: string; schema: S; run: (input: z.infer<S>) => Promise<ToolOutput> }
const tool = <S extends z.ZodType>(t: ToolDef<S>) => t as unknown as ToolDef

const r2 = (n: number) => Math.round(n * 100) / 100
const clean = (s: string) => s.replace(/\s+/g, " ").replace(/\s\.$/, "").trim()
const fullName = (c: { firstName: string; lastName: string }) => clean(`${c.firstName} ${c.lastName}`)
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
const matches = (name: string, query: string) => norm(query).split(" ").filter(Boolean).every((w) => norm(name).includes(w))
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Día, formato AAAA-MM-DD")
const ym = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).describe("Mes, formato AAAA-MM")
const DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
const CLASS_STATE = { given: "dada", noShow: "no asistió", unmarked: "sin marcar", upcoming: "por dar" }
const STATUS: Record<string, string> = { ACTIVE: "activo", PAUSED: "en pausa", STANDBY: "stand-by" }
const STEP: Record<string, string> = { PRE: "vence pronto", DUE: "vence hoy", LATE: "ya venció", REACTIVATE: "reactivar (ya se fue)", PROMISE: "prometió pagar hoy" }

/** Clientes cuyo nombre coincide; si hay varios, se le pide precisar al asistente. */
async function findClient(query: string) {
  const all = await prisma.client.findMany({ select: { id: true, firstName: true, lastName: true, isActive: true, phone: true } })
  const exact = all.filter((c) => norm(fullName(c)) === norm(query))
  const found = exact.length ? exact : all.filter((c) => matches(fullName(c), query))
  return found.sort((a, b) => Number(b.isActive) - Number(a.isActive))
}

export const TOOLS: ToolDef[] = [
  tool({
    name: "resumen_hoy",
    label: "Revisando el día de hoy",
    description: "Lo que hay que atender hoy: por cobrar, clases de hoy y sin marcar (7 días), interesados por atender, alumnos en riesgo de irse, rutinas que terminan en 7 días o menos y obligaciones por pagar en 3 días o menos. Úsala para '¿qué tengo hoy?', '¿quién está en riesgo?' o un panorama general.",
    schema: z.object({}),
    run: async () => {
      const d = await buildDigest()
      const c = (x: (typeof d.classes.today)[number]) => ({ fecha: x.date, hora: x.time, cliente: x.client, entrenador: x.trainer, tipo: x.kind === "trial" ? "prueba" : "personal", estado: CLASS_STATE[x.state] })
      return {
        data: {
          hoy: d.today,
          por_cobrar: { cantidad: d.collect.count, total_soles: r2(d.collect.total), promesas_de_hoy: d.collect.promises },
          clases_de_hoy: d.classes.today.map(c),
          clases_sin_marcar: d.classes.unmarked.map(c),
          interesados_por_atender: d.leads.map((l) => ({ nombre: clean(`${l.firstName} ${l.lastName ?? ""}`), motivo: l.alert })),
          alumnos_en_riesgo: d.risk.map((x) => ({ nombre: clean(x.name), motivo: x.reason })),
          rutinas_por_renovar: d.programs.map((x) => ({ nombre: clean(x.name), estado: x.label })),
          obligaciones_por_vencer: d.obligations.map((o) => ({ concepto: o.concept, de: `${o.year}-${String(o.month).padStart(2, "0")}`, monto: o.amount, moneda: o.currency, fecha_limite: o.payBy })),
        },
      }
    },
  }),
  tool({
    name: "cobranza",
    label: "Revisando la cobranza",
    description: "A quién cobrarle hoy por renovación o saldo pendiente, con plan, vencimiento, monto y si tiene celular registrado. También los que prometieron pagar más adelante y todos los saldos pendientes de pagos parciales. Úsala para '¿quién no me ha pagado?', '¿quién debe?', '¿a quién escribo hoy?'.",
    schema: z.object({}),
    run: async () => {
      const [c, balances] = await Promise.all([getCollections(), getAllBalances()])
      return {
        data: {
          hoy: c.today,
          escribir_hoy: c.items.map((i) => ({ nombre: clean(i.name), por: i.kind === "BALANCE" ? "saldo" : "renovación", plan: i.plan, vence: i.dueDate, dias: i.daysLeft, monto_soles: r2(i.amount), paso: STEP[i.step] ?? i.step, tiene_celular: !!i.phone, en_standby: i.standby })),
          prometieron_pagar: c.waiting.map((w) => ({ nombre: clean(w.name), fecha: w.date, monto_soles: r2(w.amount) })),
          saldos_pendientes: balances.map((b) => ({ nombre: clean(b.name), concepto: b.concept, monto_soles: b.amount, vence: b.dueDate, vencido: b.overdue })),
          mensajes_recientes: c.recent.map((x) => ({ nombre: clean(x.name), fecha: x.at, resultado: x.outcome })),
          clientes_sin_celular: c.noPhone.length,
          clientes_activos: c.totalActive,
        },
      }
    },
  }),
  tool({
    name: "renovaciones_del_mes",
    label: "Revisando las renovaciones",
    description: "Clientes cuya membresía vence en un mes, lo que pagaron la última vez (precio esperado), quién está marcado como 'no renueva' y los saldos por cobrar de ese mes. Es la proyección de ingresos del mes, en soles.",
    schema: z.object({ mes: ym }),
    run: async ({ mes }) => {
      const p = await getRenewalProjection(mes)
      return {
        data: {
          mes: p.yearMonth,
          proyectado_soles: r2(p.projectedTotal),
          no_renuevan_soles: r2(p.skippedTotal),
          saldos_soles: p.balancesTotal,
          clientes: p.clients.map((c) => ({ nombre: clean(c.name), vence: c.membershipEnd ? calendarYmd(c.membershipEnd) : null, plan: c.planName, precio_soles: r2(c.price), no_renueva: c.willSkip })),
          saldos: p.balances.map((b) => ({ nombre: clean(b.name), concepto: b.concept, monto_soles: b.amount, vence: b.dueDate })),
        },
      }
    },
  }),
  tool({
    name: "finanzas",
    label: "Revisando las finanzas",
    description: "Ingresos y egresos registrados en Finanzas, mes por mes y por categoría, en soles y dólares por separado (nunca los sumes sin decir el tipo de cambio). Los egresos son los del módulo Egresos; las obligaciones mensuales (alquiler, planilla, SUNAT) están en la consulta 'obligaciones'. Máximo 18 meses.",
    schema: z.object({ desde: ym, hasta: ym }),
    run: async ({ desde, hasta }) => {
      const [a, b] = desde <= hasta ? [desde, hasta] : [hasta, desde]
      const start = new Date(`${a}-01T00:00:00Z`)
      const [y, m] = b.split("-").map(Number)
      const end = new Date(Date.UTC(y, m, 1))
      if ((end.getTime() - start.getTime()) / 86_400_000 > 18 * 31) return { data: { error: "El rango máximo es de 18 meses." } }
      const [inc, exp] = await Promise.all([
        prisma.income.findMany({ where: { date: { gte: start, lt: end } }, select: { amount: true, currency: true, category: true, date: true } }),
        prisma.expense.findMany({ where: { date: { gte: start, lt: end } }, select: { amount: true, currency: true, category: true, date: true } }),
      ])
      const group = (rows: typeof inc, labels: Record<string, string>) => {
        const out: Record<string, { total: Record<string, number>; por_categoria: Record<string, Record<string, number>> }> = {}
        for (const row of rows) {
          const g = (out[row.date.toISOString().slice(0, 7)] ??= { total: {}, por_categoria: {} })
          const cat = (g.por_categoria[labels[row.category] ?? row.category] ??= {})
          g.total[row.currency] = r2((g.total[row.currency] ?? 0) + row.amount)
          cat[row.currency] = r2((cat[row.currency] ?? 0) + row.amount)
        }
        return out
      }
      return { data: { desde: a, hasta: b, hoy: todayYmd(), ingresos: group(inc, INCOME_CATEGORIES), egresos: group(exp, EXPENSE_CATEGORIES) } }
    },
  }),
  tool({
    name: "obligaciones",
    label: "Revisando las obligaciones",
    description: "Obligaciones mensuales del negocio (alquiler, planilla, SUNAT, etc.): pendientes y pagadas de un año, con totales por mes, y la caja y prioridades del Plan del mes si existe.",
    schema: z.object({ anio: z.number().int().min(2020).max(2100), solo_pendientes: z.boolean().describe("true para ver el detalle solo de lo pendiente") }),
    run: async ({ anio, solo_pendientes }) => {
      const [rows, plan] = await Promise.all([
        prisma.monthlyExpense.findMany({ where: { year: anio, ...(solo_pendientes ? { status: { not: "PAGADO" } } : {}) }, orderBy: [{ month: "asc" }, { sortOrder: "asc" }], select: { concept: true, category: true, currency: true, amount: true, month: true, status: true, exchangeRate: true } }),
        prisma.cashPlan.findUnique({ where: { yearMonth: todayYmd().slice(0, 7) }, include: { items: { orderBy: { priority: "asc" }, include: { expense: { select: { concept: true, amount: true, currency: true, status: true } } } } } }),
      ])
      const totals: Record<string, Record<string, number>> = {}
      for (const x of rows) {
        const t = (totals[`${anio}-${String(x.month).padStart(2, "0")}`] ??= {})
        const k = `${x.status === "PAGADO" ? "pagado" : "pendiente"}_${x.currency}`
        t[k] = r2((t[k] ?? 0) + x.amount)
      }
      return {
        data: {
          anio,
          totales_por_mes: totals,
          detalle: rows.map((x) => ({ mes: x.month, concepto: x.concept, grupo: x.category, monto: x.amount, moneda: x.currency, estado: x.status, tipo_cambio: x.currency === "USD" ? x.exchangeRate ?? 3.45 : undefined })),
          plan_del_mes: plan && {
            caja_soles: plan.bankPen, caja_dolares: plan.bankUsd, tipo_cambio: plan.exchangeRate, caja_actualizada: plan.bankUpdatedAt ? toYmd(plan.bankUpdatedAt) : null,
            pagos: plan.items.map((i) => ({ prioridad: i.priority, concepto: i.expense.concept, monto: i.expense.amount, moneda: i.expense.currency, estado: i.expense.status, fecha_limite: calendarYmd(i.payBy) })),
          },
        },
      }
    },
  }),
  tool({
    name: "clientes",
    label: "Revisando los clientes",
    description: "Lista de clientes con su plan, vencimiento, entrenador, rutina y su fin, último entrenamiento conocido, si tiene celular y si tiene cuenta en la app. Muchos entrenan sin registrarlo en la app: 'ultimo_entreno' vacío no significa que no vengan.",
    schema: z.object({
      estado: z.enum(["activos", "standby", "todos"]),
      buscar: z.string().max(60).describe("Parte del nombre, o vacío para todos"),
    }),
    run: async ({ estado, buscar }) => {
      const [overview, rows] = await Promise.all([
        getClientsOverview(),
        prisma.client.findMany({
          where: estado === "todos" ? {} : { isActive: estado === "activos" },
          select: { id: true, firstName: true, lastName: true, isActive: true, phone: true, trainer: true, partnerOfId: true, createdAt: true, user: { select: { id: true } }, membershipEnd: true, membershipPlan: { select: { name: true } } },
          orderBy: { firstName: "asc" },
        }),
      ])
      const byId = new Map(overview.map((o) => [o.id, o]))
      const list = rows.filter((c) => !buscar.trim() || matches(fullName(c), buscar))
      return {
        data: {
          hoy: todayYmd(),
          cantidad: list.length,
          clientes: list.map((c) => {
            const o = byId.get(c.id)
            return {
              nombre: fullName(c), activo: c.isActive, estado: o ? STATUS[o.status] ?? o.status : undefined,
              plan: o?.membership.planName ?? c.membershipPlan?.name ?? null, vence: o?.membership.end ?? (c.membershipEnd ? calendarYmd(c.membershipEnd) : null),
              entrenador: c.trainer, es_pareja_de_otra_ficha: c.partnerOfId ? true : undefined,
              rutina: o?.program?.name ?? null, rutina_termina: o?.program?.end ?? null, ultimo_entreno: o?.lastWorkout ?? null, entrenos_7_dias: o?.workoutsLast7 ?? null,
              tiene_celular: hasValidPhone(c.phone), tiene_app: !!c.user, desde: toYmd(c.createdAt),
            }
          }),
        },
      }
    },
  }),
  tool({
    name: "ficha_cliente",
    label: "Abriendo la ficha del cliente",
    description: "Detalle de un cliente: membresía, pagos recientes, paquete de clases personales y asistencia, rutina completa con ejercicios y sus últimos entrenamientos registrados con cargas. Úsala antes de proponer cambios de carga o de rutina, o de redactar un mensaje personalizado.",
    schema: z.object({ nombre: z.string().min(2).max(80) }),
    run: async ({ nombre }) => {
      const found = await findClient(nombre)
      if (!found.length) return { data: { error: `No hay ningún cliente que coincida con "${nombre}".` } }
      if (found.length > 1) return { data: { error: "Hay varios clientes con ese nombre; pregunta cuál es.", coincidencias: found.slice(0, 10).map((c) => ({ nombre: fullName(c), activo: c.isActive })) } }
      const id = found[0].id
      const today = todayYmd()
      const c = await prisma.client.findUniqueOrThrow({
        where: { id },
        select: {
          id: true, firstName: true, lastName: true, isActive: true, trainer: true, phone: true, membershipStart: true, membershipEnd: true, partnerOfId: true,
          membershipPlan: { select: { name: true } }, partnerOf: { select: { firstName: true, lastName: true } }, partner: { select: { firstName: true, lastName: true } },
          user: { select: { id: true } }, coachingProfile: { select: { status: true, goal: true, level: true, trainingDays: true } },
          programs: { where: { isActive: true, isTemplate: false }, orderBy: { updatedAt: "desc" }, take: 1, include: { days: { orderBy: { order: "asc" }, include: { exercises: { orderBy: { order: "asc" }, include: { exercise: { select: { name: true } } } } } } } },
          workoutLogs: { where: { completedAt: { not: null } }, orderBy: { date: "desc" }, take: 6, include: { sets: { where: { completed: true }, orderBy: { setNumber: "asc" }, include: { exercise: { select: { name: true } } } } } },
        },
      })
      const owner = c.partnerOfId ?? c.id
      const [payments, plans, ownerClient] = await Promise.all([
        prisma.payment.findMany({ where: { clientId: owner }, orderBy: { paidAt: "desc" }, take: 8, select: { amount: true, concept: true, paidAt: true, balanceDue: true, balanceDueDate: true, balancePaidAt: true } }),
        prisma.clientTrainingPlan.findMany({ where: { clientId: owner }, orderBy: { createdAt: "desc" }, take: 2, include: { sessions: { select: { scheduledDate: true, attended: true, completedAt: true } } } }),
        owner === c.id ? null : prisma.client.findUnique({ where: { id: owner }, select: { membershipStart: true, membershipEnd: true, membershipPlan: { select: { name: true } } } }),
      ])
      const mem = ownerClient ?? c
      const prog = c.programs[0]
      return {
        data: {
          hoy: today,
          nombre: fullName(c), activo: c.isActive, estado: c.coachingProfile ? STATUS[c.coachingProfile.status] ?? c.coachingProfile.status : null,
          entrenador: c.trainer, objetivo: c.coachingProfile?.goal ?? null, nivel: c.coachingProfile?.level ?? null, dias_por_semana: c.coachingProfile?.trainingDays ?? null,
          pareja: c.partnerOf ? fullName(c.partnerOf) : c.partner ? fullName(c.partner) : undefined, tiene_celular: hasValidPhone(c.phone), tiene_app: !!c.user,
          membresia: { plan: mem.membershipPlan?.name ?? null, inicio: mem.membershipStart ? calendarYmd(mem.membershipStart) : null, vence: mem.membershipEnd ? calendarYmd(mem.membershipEnd) : null },
          pagos: payments.map((p) => ({ fecha: toYmd(p.paidAt), monto: p.amount, concepto: p.concept, saldo_pendiente: p.balanceDue && !p.balancePaidAt ? p.balanceDue : undefined, saldo_vence: p.balanceDue && !p.balancePaidAt && p.balanceDueDate ? calendarYmd(p.balanceDueDate) : undefined })),
          clases_personales: plans.map((p) => {
            const st = p.sessions.map((s) => ({ d: s.scheduledDate ? calendarYmd(s.scheduledDate) : null, ok: s.attended ?? (s.completedAt ? true : null) }))
            return { paquete: trainingPlanName(p), estado: p.status, total: p.sessions.length, asistio: st.filter((s) => s.ok === true).length, falto: st.filter((s) => s.ok === false).length, sin_marcar: st.filter((s) => s.ok === null && s.d && s.d < today).length, proxima: st.filter((s) => s.ok === null && s.d && s.d >= today).map((s) => s.d).sort()[0] ?? null }
          }),
          rutina: prog && {
            nombre: prog.name, ...programDates(prog, today),
            dias: prog.days.map((d) => ({ nombre: d.name, dia: d.dayOfWeek != null ? DAYS[d.dayOfWeek] : null, ejercicios: d.exercises.map((e) => `${e.exercise.name}: ${e.sets} × ${e.reps}${e.load ? ` · ${e.load}` : ""}${e.rir ? ` · RIR ${e.rir}` : ""} · descanso ${e.restSec}s`) })),
          },
          ultimos_entrenamientos: c.workoutLogs.map((w) => {
            const by = new Map<string, typeof w.sets>()
            for (const s of w.sets) by.set(s.exercise.name, [...(by.get(s.exercise.name) ?? []), s])
            return { fecha: w.date, dia: w.dayName, ejercicios: [...by].map(([name, sets]) => ({ nombre: name, series: sets.map(formatSet), mejor_1rm_estimado: r2(Math.max(0, ...sets.map((s) => estimate1RM(s.weight ?? 0, s.reps ?? 0)))) })) }
          }),
        },
      }
    },
  }),
  tool({
    name: "clases",
    label: "Revisando las clases",
    description: "Clases personales y de prueba entre dos días, con entrenador y estado, y el total por entrenador (sirve para comisiones). Máximo 62 días.",
    schema: z.object({ desde: ymd, hasta: ymd, entrenador: z.string().max(40).describe("Nombre del entrenador o vacío para todos"), detalle: z.boolean().describe("true para listar cada clase; false para solo totales") }),
    run: async ({ desde, hasta, entrenador, detalle }) => {
      const [a, b] = desde <= hasta ? [desde, hasta] : [hasta, desde]
      if (b > addCalendarDays(a, 62)) return { data: { error: "El rango máximo es de 62 días." } }
      const list = (await getClassesBetween(a, b)).filter((c) => !entrenador.trim() || matches(c.trainer, entrenador))
      const totals: Record<string, Record<string, number>> = {}
      for (const c of list) {
        const t = (totals[c.trainer] ??= {})
        const k = `${c.kind === "trial" ? "prueba" : "personal"}: ${CLASS_STATE[c.state]}`
        t[k] = (t[k] ?? 0) + 1
      }
      return { data: { desde: a, hasta: b, hoy: todayYmd(), total_por_entrenador: totals, clases: detalle ? list.map((c) => ({ fecha: c.date, dia: DAYS[weekdayYmd(c.date)], hora: c.time, cliente: c.client, entrenador: c.trainer, tipo: c.kind === "trial" ? "prueba" : c.plan, numero: c.number, estado: CLASS_STATE[c.state] })) : undefined } }
    },
  }),
  tool({
    name: "interesados",
    label: "Revisando los interesados",
    description: "Embudo de ventas: personas interesadas abiertas y las cerradas en los últimos 90 días, con etapa, origen, clase de prueba y próximo contacto. Incluye cuántas hay por etapa y por origen.",
    schema: z.object({}),
    run: async () => {
      const { today, leads } = await getLeads()
      const count = (f: (l: (typeof leads)[number]) => string) => leads.reduce<Record<string, number>>((o, l) => ({ ...o, [f(l)]: (o[f(l)] ?? 0) + 1 }), {})
      return {
        data: {
          hoy: today, por_etapa: count((l) => STAGE_LABEL[l.stage]), por_origen: count((l) => SOURCE_LABEL[l.source]),
          interesados: leads.map((l) => ({ nombre: clean(`${l.firstName} ${l.lastName ?? ""}`), etapa: STAGE_LABEL[l.stage], origen: SOURCE_LABEL[l.source], recomendado_por: l.referredBy, objetivo: l.goal, plan_de_interes: l.planInterest, llego: l.createdAt, contactado: l.contactedAt, proximo_contacto: l.nextContactOn, clase_de_prueba: l.trial && { fecha: l.trial.date, hora: l.trial.startTime, estado: l.trial.status }, motivo_perdido: l.lostReason, alerta: l.alert, tiene_celular: !!normalizePhone(l.phone) })),
        },
      }
    },
  }),
  tool({
    name: "uso_de_la_app",
    label: "Revisando el uso de la app",
    description: "Cuánto se usa la app: clientes activos con celular, con cuenta y con rutina, y entrenamientos y check-ins registrados en los últimos 30 días.",
    schema: z.object({}),
    run: async () => {
      const since = addCalendarDays(todayYmd(), -30)
      const [active, programs, logs, checkIns] = await Promise.all([
        prisma.client.findMany({ where: { isActive: true }, select: { id: true, phone: true, user: { select: { id: true } } } }),
        prisma.program.findMany({ where: { isActive: true, isTemplate: false, clientId: { not: null }, days: { some: {} } }, select: { clientId: true } }),
        prisma.workoutLog.findMany({ where: { completedAt: { not: null }, date: { gte: since } }, select: { clientId: true } }),
        prisma.checkIn.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
      ])
      const withProgram = new Set(programs.map((p) => p.clientId))
      return { data: { clientes_activos: active.length, con_celular: active.filter((c) => hasValidPhone(c.phone)).length, con_cuenta_en_la_app: active.filter((c) => c.user).length, con_rutina: active.filter((c) => withProgram.has(c.id)).length, entrenamientos_registrados_30_dias: logs.length, clientes_que_registraron_30_dias: new Set(logs.map((l) => l.clientId)).size, check_ins_30_dias: checkIns } }
    },
  }),
  tool({
    name: "borrador_whatsapp",
    label: "Preparando un borrador",
    description: "Prepara un mensaje de WhatsApp para UN cliente o interesado. NO lo envía: al dueño le aparece una tarjeta con el texto, que puede editar, y un botón para abrir WhatsApp. Úsala solo cuando el dueño pida redactar un mensaje para alguien. No repitas el texto del mensaje en tu respuesta.",
    schema: z.object({ tipo: z.enum(["cliente", "interesado"]), nombre: z.string().min(2).max(80).describe("Nombre completo tal como salió en la consulta"), mensaje: z.string().min(5).max(1200) }),
    run: async ({ tipo, nombre, mensaje }) => {
      if (tipo === "cliente") {
        const found = await findClient(nombre)
        if (found.length !== 1) return { data: { error: found.length ? "Hay varios clientes con ese nombre; pregunta cuál es." : "No hay ningún cliente con ese nombre.", coincidencias: found.slice(0, 10).map(fullName) } }
        const c = found[0]
        const phone = normalizePhone(c.phone)
        return { data: { ok: true, para: fullName(c), tiene_celular: !!phone }, draft: { kind: "whatsapp", name: fullName(c), text: mensaje, url: phone ? whatsappUrl(phone, "") : null, href: `/coaching/clients/${c.id}` } }
      }
      const { leads } = await getLeads()
      const name = (l: (typeof leads)[number]) => clean(`${l.firstName} ${l.lastName ?? ""}`)
      const exact = leads.filter((l) => norm(name(l)) === norm(nombre))
      const found = exact.length ? exact : leads.filter((l) => matches(name(l), nombre))
      if (found.length !== 1) return { data: { error: found.length ? "Hay varios interesados con ese nombre; pregunta cuál es." : "No hay ningún interesado con ese nombre." } }
      const phone = normalizePhone(found[0].phone)
      return { data: { ok: true, para: name(found[0]), tiene_celular: !!phone }, draft: { kind: "whatsapp", name: name(found[0]), text: mensaje, url: phone ? whatsappUrl(phone, "") : null, href: "/coaching/interesados" } }
    },
  }),
]

const MAX_RESULT_CHARS = 60_000

/** Ejecuta una consulta. Valida lo que pidió la IA antes de tocar la base. */
export async function runTool(name: string, input: unknown): Promise<{ content: string; isError: boolean; draft?: Draft }> {
  const t = TOOLS.find((x) => x.name === name)
  if (!t) return { content: JSON.stringify({ error: "Consulta desconocida" }), isError: true }
  const parsed = t.schema.safeParse(input)
  if (!parsed.success) return { content: JSON.stringify({ INVALID_JSON: JSON.stringify(input), error: z.prettifyError(parsed.error) }), isError: true }
  try {
    const out = await t.run(parsed.data)
    const json = JSON.stringify(out.data)
    if (json.length > MAX_RESULT_CHARS) return { content: JSON.stringify({ error: "La respuesta es demasiado grande. Acota la consulta (menos días, menos meses o busca por nombre)." }), isError: true }
    return { content: json, isError: false, draft: out.draft }
  } catch (e) {
    console.error("[asistente] consulta", name, (e as Error).message)
    return { content: JSON.stringify({ error: "No se pudo hacer la consulta." }), isError: true }
  }
}
