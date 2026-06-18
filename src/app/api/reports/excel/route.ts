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

  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0)
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0)
  const net = totalIncome - totalExpense

  const titleRow = summary.addRow(["REPORTE FORTIA", `${from} al ${to}`])
  titleRow.font = { bold: true, size: 14 }
  titleRow.height = 28
  summary.addRow([])

  const rows = [
    ["Total Ingresos", totalIncome],
    ["Total Egresos", totalExpense],
    ["Neto del período", net],
    ["N° transacciones ingreso", incomes.length],
    ["N° transacciones egreso", expenses.length],
    ["Clientes activos totales", clients],
    ["Nuevos clientes en período", newClients.length],
  ]

  rows.forEach(([label, value], i) => {
    const row = summary.addRow([label, value])
    if (typeof value === "number" && i < 3) {
      row.getCell(2).numFmt = '"S/"#,##0.00'
      row.getCell(2).font = { bold: true, color: { argb: i === 2 && net < 0 ? "FFCC0000" : "FF006600" } }
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
    { key: "amount", header: "Monto (S/)", width: 14 },
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
      amount: inc.amount,
    })
    row.getCell("amount").numFmt = '"S/"#,##0.00'
    styleData(row, idx % 2 === 0)
  })

  const incTotal = incSheet.addRow({ description: "TOTAL", amount: totalIncome })
  incTotal.font = { bold: true }
  incTotal.getCell("amount").numFmt = '"S/"#,##0.00'
  incTotal.getCell("amount").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9F2D9" } }

  // ── Hoja 3: EGRESOS ──────────────────────────────────────────
  const expSheet = workbook.addWorksheet("Egresos")
  expSheet.columns = [
    { key: "date", header: "Fecha", width: 14 },
    { key: "description", header: "Descripción", width: 35 },
    { key: "category", header: "Categoría", width: 18 },
    { key: "vendor", header: "Proveedor", width: 25 },
    { key: "amount", header: "Monto (S/)", width: 14 },
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
      amount: exp.amount,
    })
    row.getCell("amount").numFmt = '"S/"#,##0.00'
    styleData(row, idx % 2 === 0)
  })

  const expTotal = expSheet.addRow({ description: "TOTAL", amount: totalExpense })
  expTotal.font = { bold: true }
  expTotal.getCell("amount").numFmt = '"S/"#,##0.00'
  expTotal.getCell("amount").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFD9D9" } }

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
