import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import ExcelJS from "exceljs"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (!from || !to) return NextResponse.json({ error: "Faltan fechas" }, { status: 400 })

  const start = new Date(from)
  const end = new Date(to)
  end.setHours(23, 59, 59, 999)

  const [incomes, expenses, clients, newClients] = await Promise.all([
    prisma.income.findMany({
      where: { date: { gte: start, lte: end } },
      include: { client: { select: { firstName: true, lastName: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    }),
    prisma.client.count({ where: { isActive: true } }),
    prisma.client.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: { membershipPlan: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ])

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "FORTIA"
  workbook.created = new Date()

  const orange = "FFFF6600"
  const white = "FFFFFFFF"
  const lightGray = "FFF5F5F5"

  function styleHeader(row: ExcelJS.Row) {
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: orange } }
      cell.font = { bold: true, color: { argb: white }, size: 11 }
      cell.alignment = { horizontal: "center", vertical: "middle" }
      cell.border = {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" },
      }
    })
    row.height = 22
  }

  function styleData(row: ExcelJS.Row, isEven: boolean) {
    row.eachCell((cell) => {
      if (isEven) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightGray } }
      cell.alignment = { vertical: "middle" }
      cell.border = {
        top: { style: "hair" }, bottom: { style: "hair" },
        left: { style: "hair" }, right: { style: "hair" },
      }
    })
    row.height = 18
  }

  // ── Hoja 1: RESUMEN ──────────────────────────────────────────
  const summary = workbook.addWorksheet("Resumen")
  summary.columns = [
    { key: "label", width: 30 },
    { key: "value", width: 20 },
  ]

  const totalIncomePEN = incomes.filter(i => i.currency === "PEN").reduce((s, i) => s + i.amount, 0)
  const totalIncomeUSD = incomes.filter(i => i.currency === "USD").reduce((s, i) => s + i.amount, 0)
  const totalExpensePEN = expenses.filter(e => e.currency === "PEN").reduce((s, e) => s + e.amount, 0)
  const totalExpenseUSD = expenses.filter(e => e.currency === "USD").reduce((s, e) => s + e.amount, 0)
  const netPEN = totalIncomePEN - totalExpensePEN
  const netUSD = totalIncomeUSD - totalExpenseUSD

  const titleRow = summary.addRow(["REPORTE FORTIA", `${from} al ${to}`])
  titleRow.font = { bold: true, size: 14 }
  titleRow.height = 28
  summary.addRow([])

  const summaryRows: [string, number | string, string?][] = [
    ["Total Ingresos (S/)", totalIncomePEN, '"S/"#,##0.00'],
    ["Total Ingresos (USD)", totalIncomeUSD, '"$"#,##0.00'],
    ["Total Egresos (S/)", totalExpensePEN, '"S/"#,##0.00'],
    ["Total Egresos (USD)", totalExpenseUSD, '"$"#,##0.00'],
    ["Neto del período (S/)", netPEN, '"S/"#,##0.00'],
    ["Neto del período (USD)", netUSD, '"$"#,##0.00'],
    ["N° transacciones ingreso", incomes.length],
    ["N° transacciones egreso", expenses.length],
    ["Clientes activos totales", clients],
    ["Nuevos clientes en período", newClients.length],
  ]

  summaryRows.forEach(([label, value, numFmt], i) => {
    const row = summary.addRow([label, value])
    if (numFmt && typeof value === "number") {
      row.getCell(2).numFmt = numFmt
      const isNet = i === 4 || i === 5
      const isNeg = (i === 4 && netPEN < 0) || (i === 5 && netUSD < 0)
      row.getCell(2).font = { bold: true, color: { argb: isNet && isNeg ? "FFCC0000" : "FF006600" } }
    }
    row.height = 18
  })

  // ── Hoja 2: INGRESOS ─────────────────────────────────────────
  const incSheet = workbook.addWorksheet("Ingresos")
  incSheet.columns = [
    { key: "date", header: "Fecha", width: 14 },
    { key: "description", header: "Descripción", width: 35 },
    { key: "category", header: "Categoría", width: 18 },
    { key: "client", header: "Cliente", width: 25 },
    { key: "currency", header: "Moneda", width: 10 },
    { key: "amount", header: "Monto", width: 14 },
  ]

  const INCOME_CAT: Record<string, string> = {
    MEMBERSHIP: "Membresía", PRODUCT_SALE: "Venta producto",
    DAY_PASS: "Pase diario", OTHER: "Otro",
  }

  styleHeader(incSheet.getRow(1))
  incomes.forEach((inc, idx) => {
    const row = incSheet.addRow({
      date: new Date(inc.date).toLocaleDateString("es-PE"),
      description: inc.description ?? "",
      category: INCOME_CAT[inc.category] ?? inc.category,
      client: inc.client ? `${inc.client.firstName} ${inc.client.lastName}` : "",
      currency: inc.currency === "USD" ? "USD" : "SOLES",
      amount: inc.amount,
    })
    row.getCell("amount").numFmt = inc.currency === "USD" ? '"$"#,##0.00' : '"S/"#,##0.00'
    styleData(row, idx % 2 === 0)
  })

  const incTotalPEN = incSheet.addRow({ description: "TOTAL SOLES", currency: "SOLES", amount: totalIncomePEN })
  incTotalPEN.font = { bold: true }
  incTotalPEN.getCell("amount").numFmt = '"S/"#,##0.00'
  incTotalPEN.getCell("amount").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9F2D9" } }
  if (totalIncomeUSD > 0) {
    const incTotalUSD = incSheet.addRow({ description: "TOTAL USD", currency: "USD", amount: totalIncomeUSD })
    incTotalUSD.font = { bold: true }
    incTotalUSD.getCell("amount").numFmt = '"$"#,##0.00'
    incTotalUSD.getCell("amount").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9F2D9" } }
  }

  // ── Hoja 3: EGRESOS ──────────────────────────────────────────
  const expSheet = workbook.addWorksheet("Egresos")
  expSheet.columns = [
    { key: "date", header: "Fecha", width: 14 },
    { key: "description", header: "Descripción", width: 35 },
    { key: "category", header: "Categoría", width: 18 },
    { key: "vendor", header: "Proveedor", width: 25 },
    { key: "currency", header: "Moneda", width: 10 },
    { key: "amount", header: "Monto", width: 14 },
  ]

  const EXP_CAT: Record<string, string> = {
    RENT: "Alquiler", ELECTRICITY: "Luz", WATER: "Agua",
    INTERNET: "Internet", SALARY: "Salario", SUPPLIER: "Proveedor",
    MAINTENANCE: "Mantenimiento", OTHER: "Otro",
  }

  styleHeader(expSheet.getRow(1))
  expenses.forEach((exp, idx) => {
    const row = expSheet.addRow({
      date: new Date(exp.date).toLocaleDateString("es-PE"),
      description: exp.description ?? "",
      category: EXP_CAT[exp.category] ?? exp.category,
      vendor: exp.vendor ?? "",
      currency: exp.currency === "USD" ? "USD" : "SOLES",
      amount: exp.amount,
    })
    row.getCell("amount").numFmt = exp.currency === "USD" ? '"$"#,##0.00' : '"S/"#,##0.00'
    styleData(row, idx % 2 === 0)
  })

  const expTotalPEN = expSheet.addRow({ description: "TOTAL SOLES", currency: "SOLES", amount: totalExpensePEN })
  expTotalPEN.font = { bold: true }
  expTotalPEN.getCell("amount").numFmt = '"S/"#,##0.00'
  expTotalPEN.getCell("amount").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFD9D9" } }
  if (totalExpenseUSD > 0) {
    const expTotalUSD = expSheet.addRow({ description: "TOTAL USD", currency: "USD", amount: totalExpenseUSD })
    expTotalUSD.font = { bold: true }
    expTotalUSD.getCell("amount").numFmt = '"$"#,##0.00'
    expTotalUSD.getCell("amount").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFD9D9" } }
  }

  // ── Hoja 4: NUEVOS CLIENTES ───────────────────────────────────
  const cliSheet = workbook.addWorksheet("Nuevos Clientes")
  cliSheet.columns = [
    { key: "date", header: "Registro", width: 14 },
    { key: "name", header: "Nombre", width: 28 },
    { key: "dni", header: "DNI", width: 12 },
    { key: "phone", header: "Teléfono", width: 14 },
    { key: "plan", header: "Plan", width: 16 },
    { key: "membershipEnd", header: "Vence", width: 14 },
  ]

  styleHeader(cliSheet.getRow(1))
  newClients.forEach((c, idx) => {
    const row = cliSheet.addRow({
      date: new Date(c.createdAt).toLocaleDateString("es-PE"),
      name: `${c.firstName} ${c.lastName}`,
      dni: c.dni ?? "",
      phone: c.phone ?? "",
      plan: c.membershipPlan?.name ?? "Sin plan",
      membershipEnd: c.membershipEnd ? new Date(c.membershipEnd).toLocaleDateString("es-PE") : "",
    })
    styleData(row, idx % 2 === 0)
  })

  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reporte-fortia-${from}-${to}.xlsx"`,
    },
  })
}
