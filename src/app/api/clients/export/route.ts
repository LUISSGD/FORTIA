import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import ExcelJS from "exceljs"

function getEstado(membershipEnd: Date | null): string {
  if (!membershipEnd) return "Sin fecha"
  const now = new Date()
  const diff = (membershipEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return "Vencido"
  if (diff <= 5) return "Urgente"
  if (diff <= 10) return "Por vencer"
  return "Activo"
}

function fmt(d: Date | null | undefined): string {
  if (!d) return ""
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export async function GET() {
  const clients = await prisma.client.findMany({
    include: {
      membershipPlan: { select: { name: true } },
      payments: {
        orderBy: { paidAt: "desc" },
        take: 1,
        select: { paidAt: true, amount: true, currency: true },
      },
    },
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
  })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "FORTIA"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Clientes")

  // Column definitions
  sheet.columns = [
    { header: "Nombre", key: "nombre", width: 30 },
    { header: "DNI", key: "dni", width: 12 },
    { header: "Teléfono", key: "telefono", width: 15 },
    { header: "Email", key: "email", width: 28 },
    { header: "Plan", key: "plan", width: 28 },
    { header: "Inicio membresía", key: "inicio", width: 18 },
    { header: "Fin membresía", key: "fin", width: 18 },
    { header: "Estado", key: "estado", width: 14 },
    { header: "Último pago", key: "ultimoPago", width: 18 },
    { header: "Monto último pago", key: "montoUltimoPago", width: 20 },
    { header: "Activo", key: "activo", width: 10 },
  ]

  // Header row styling
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF97316" } }
  headerRow.alignment = { vertical: "middle", horizontal: "center" }
  headerRow.height = 20

  // Estado color map
  const estadoColor: Record<string, string> = {
    Activo: "FF22C55E",
    "Por vencer": "FFFBBF24",
    Urgente: "FFEF4444",
    Vencido: "FF6B7280",
    "Sin fecha": "FFD1D5DB",
  }

  for (const c of clients) {
    const nombre = [c.firstName, c.lastName, c.firstName2, c.lastName2]
      .filter(Boolean).join(" ")
    const estado = c.isActive ? getEstado(c.membershipEnd) : "Inactivo"
    const lastPayment = c.payments[0]

    const row = sheet.addRow({
      nombre,
      dni: c.dni ?? c.dni2 ?? "",
      telefono: c.phone ?? c.phone2 ?? "",
      email: c.email ?? "",
      plan: c.membershipPlan?.name ?? "",
      inicio: fmt(c.membershipStart),
      fin: fmt(c.membershipEnd),
      estado,
      ultimoPago: lastPayment ? fmt(lastPayment.paidAt) : "",
      montoUltimoPago: lastPayment
        ? `${lastPayment.currency === "USD" ? "$ " : "S/ "}${lastPayment.amount.toFixed(2)}`
        : "",
      activo: c.isActive ? "Sí" : "No",
    })

    row.alignment = { vertical: "middle" }

    // Color the Estado cell
    const estadoCell = row.getCell("estado")
    const color = estadoColor[estado] ?? "FFD1D5DB"
    estadoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } }
    estadoCell.font = { color: { argb: estado === "Por vencer" ? "FF000000" : "FFFFFFFF" }, bold: true }
    estadoCell.alignment = { horizontal: "center" }
  }

  // Freeze header row
  sheet.views = [{ state: "frozen", ySplit: 1 }]

  // Alternating row background
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    if (rowNumber % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor?.argb === undefined) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } }
        }
      })
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()

  const date = new Date().toISOString().split("T")[0]
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="clientes-fortia-${date}.xlsx"`,
    },
  })
}
