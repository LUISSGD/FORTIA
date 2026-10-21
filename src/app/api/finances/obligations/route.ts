import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// Flujo de obligaciones: cuadro anual (concepto × mes) sobre MonthlyExpense.
// Cada celda es un MonthlyExpense (concepto, mes, año, monto, estado). Las filas se identifican por el
// concepto; `category` agrupa filas con subtotal (p. ej. SUNAT) y `sortOrder` fija su orden.

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const money = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100
const validYear = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) >= 2020 && Number(v) <= 2100 ? Number(v) : null)
const validMonth = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 12 ? Number(v) : null)
const clean = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "")
/** Moneda y tipo de cambio de una fila (USD → se pasa a soles con exchangeRate). */
const fx = (b: { currency?: unknown; exchangeRate?: unknown }) =>
  b.currency === "USD" ? { currency: "USD", exchangeRate: Number(b.exchangeRate) > 0 ? Number(b.exchangeRate) : 3.45 } : { currency: "PEN", exchangeRate: null }

async function rowItems(year: number, concept: string) {
  const all = await prisma.monthlyExpense.findMany({ where: { year } })
  return all.filter((i) => same(i.concept, concept))
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const year = validYear(new URL(request.url).searchParams.get("year")) ?? new Date().getFullYear()
  const items = await prisma.monthlyExpense.findMany({ where: { year }, orderBy: { createdAt: "asc" } })
  return NextResponse.json({ year, items })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const year = validYear(body.year)
  if (!year) return NextResponse.json({ error: "Año no válido" }, { status: 400 })

  switch (body.action) {
    // Importa el cuadro de Excel: crea o actualiza cada celda (conserva el estado pagado/pendiente).
    case "import": {
      const rows = (Array.isArray(body.rows) ? body.rows : []) as { concept: string; category?: string | null; currency?: string; exchangeRate?: number | null; amounts: Record<string, number> }[]
      const existing = await prisma.monthlyExpense.findMany({ where: { year } })
      let created = 0, updated = 0
      await prisma.$transaction(async (tx) => {
        for (const [idx, r] of rows.entries()) {
          const concept = clean(r.concept)
          if (!concept) continue
          for (const [m, raw] of Object.entries(r.amounts ?? {})) {
            const month = validMonth(m)
            if (!month) continue
            const amount = money(raw)
            const found = existing.find((i) => i.month === month && same(i.concept, concept))
            const data = { amount, category: clean(r.category) || null, sortOrder: idx, ...fx(r) }
            if (found) { await tx.monthlyExpense.update({ where: { id: found.id }, data }); updated++ }
            else if (amount > 0) { await tx.monthlyExpense.create({ data: { ...data, concept, month, year } }); created++ }
          }
          // Filas que ya existían fuera de los meses del Excel: mismo grupo y orden
          await tx.monthlyExpense.updateMany({
            where: { year, id: { in: existing.filter((i) => same(i.concept, concept)).map((i) => i.id) } },
            data: { category: clean(r.category) || null, sortOrder: idx, ...fx(r) },
          })
        }
      })
      return NextResponse.json({ created, updated })
    }

    // Cambia una celda; con applyForward copia el monto a los meses siguientes del año.
    case "setCell": {
      const month = validMonth(body.month)
      const concept = clean(body.concept)
      if (!month || !concept) return NextResponse.json({ error: "Celda no válida" }, { status: 400 })
      const amount = money(body.amount)
      const row = await rowItems(year, concept)
      const meta = { category: row[0]?.category ?? null, sortOrder: row[0]?.sortOrder ?? null }
      const money$ = "currency" in body ? fx(body) : { currency: row[0]?.currency ?? "PEN", exchangeRate: row[0]?.exchangeRate ?? null }
      const months = body.applyForward ? Array.from({ length: 13 - month }, (_, i) => month + i) : [month]
      for (const m of months) {
        const found = row.find((i) => i.month === m)
        const isTarget = m === month
        const status = isTarget && (body.status === "PAGADO" || body.status === "PENDIENTE") ? body.status : undefined
        const data = {
          amount,
          ...money$,
          ...(status ? { status, paidAt: status === "PAGADO" ? (found?.paidAt ?? new Date()) : null } : {}),
          ...(isTarget && "notes" in body ? { notes: clean(body.notes) || null } : {}),
        }
        if (found) await prisma.monthlyExpense.update({ where: { id: found.id }, data })
        else if (amount > 0 || status === "PAGADO") await prisma.monthlyExpense.create({ data: { concept: row[0]?.concept ?? concept, month: m, year, ...meta, ...data } })
      }
      return NextResponse.json({ ok: true })
    }

    // Marca pagado / pendiente sin tocar el monto.
    case "setStatus": {
      const month = validMonth(body.month)
      const found = month ? (await rowItems(year, clean(body.concept))).find((i) => i.month === month) : null
      if (!found) return NextResponse.json({ error: "No hay monto en ese mes" }, { status: 404 })
      const paid = body.status === "PAGADO"
      await prisma.monthlyExpense.update({ where: { id: found.id }, data: { status: paid ? "PAGADO" : "PENDIENTE", paidAt: paid ? new Date() : null } })
      return NextResponse.json({ ok: true })
    }

    // Nueva fila: monto fijo desde un mes hasta diciembre (o solo ese mes).
    case "addRow": {
      const concept = clean(body.concept)
      const from = validMonth(body.fromMonth) ?? 1
      const to = body.onlyOneMonth ? from : 12
      if (!concept) return NextResponse.json({ error: "Escribe el concepto" }, { status: 400 })
      if ((await rowItems(year, concept)).length) return NextResponse.json({ error: "Ese concepto ya existe en el cuadro" }, { status: 409 })
      const amount = money(body.amount)
      const max = await prisma.monthlyExpense.aggregate({ where: { year }, _max: { sortOrder: true } })
      const sortOrder = (max._max.sortOrder ?? -1) + 1
      await prisma.monthlyExpense.createMany({
        data: Array.from({ length: to - from + 1 }, (_, i) => ({ concept, month: from + i, year, amount, category: clean(body.category) || null, sortOrder, ...fx(body) })),
      })
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    // Renombra la fila o cambia su grupo.
    case "editRow": {
      const row = await rowItems(year, clean(body.concept))
      const newConcept = clean(body.newConcept) || row[0]?.concept
      if (!row.length || !newConcept) return NextResponse.json({ error: "Fila no encontrada" }, { status: 404 })
      await prisma.monthlyExpense.updateMany({ where: { id: { in: row.map((i) => i.id) } }, data: { concept: newConcept, category: clean(body.category) || null } })
      return NextResponse.json({ ok: true })
    }

    case "deleteRow": {
      const row = await rowItems(year, clean(body.concept))
      await prisma.monthlyExpense.deleteMany({ where: { id: { in: row.map((i) => i.id) } } })
      return NextResponse.json({ deleted: row.length })
    }

    // Nuevo orden de las filas (lista de conceptos de arriba a abajo).
    case "reorder": {
      const concepts = (Array.isArray(body.concepts) ? body.concepts : []).map(clean)
      const all = await prisma.monthlyExpense.findMany({ where: { year }, select: { id: true, concept: true } })
      await prisma.$transaction(
        concepts.map((c: string, idx: number) =>
          prisma.monthlyExpense.updateMany({ where: { id: { in: all.filter((i) => same(i.concept, c)).map((i) => i.id) } }, data: { sortOrder: idx } }),
        ),
      )
      return NextResponse.json({ ok: true })
    }
  }
  return NextResponse.json({ error: "Acción no válida" }, { status: 400 })
}
