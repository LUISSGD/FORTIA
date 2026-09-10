import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function getEstado(membershipEnd: Date | null, isActive: boolean): string {
  if (!isActive) return "Inactivo"
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

function csvCell(value: string | number | null | undefined): string {
  const str = String(value ?? "")
  // Wrap in quotes if contains comma, newline, or quote
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET() {
  try {
  const clients = await prisma.client.findMany({
    include: {
      membershipPlan: { select: { name: true } },
      payments: {
        orderBy: { paidAt: "desc" },
        take: 1,
        select: { paidAt: true, amount: true },
      },
    },
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
  })

  const headers = [
    "Nombre",
    "DNI",
    "Teléfono",
    "Email",
    "Plan",
    "Inicio membresía",
    "Fin membresía",
    "Estado",
    "Último pago",
    "Monto último pago",
    "Activo",
  ]

  const rows = clients.map((c) => {
    const nombre = [c.firstName, c.lastName, c.firstName2, c.lastName2]
      .filter(Boolean).join(" ")
    const lastPayment = c.payments[0]
    const montoUltimoPago = lastPayment
      ? `S/ ${lastPayment.amount.toFixed(2)}`
      : ""

    return [
      nombre,
      c.dni ?? c.dni2 ?? "",
      c.phone ?? c.phone2 ?? "",
      c.email ?? "",
      c.membershipPlan?.name ?? "",
      fmt(c.membershipStart),
      fmt(c.membershipEnd),
      getEstado(c.membershipEnd, c.isActive),
      lastPayment ? fmt(lastPayment.paidAt) : "",
      montoUltimoPago,
      c.isActive ? "Sí" : "No",
    ].map(csvCell).join(",")
  })

  // UTF-8 BOM so Excel opens it correctly with accents
  const csv = "﻿" + [headers.map(csvCell).join(","), ...rows].join("\r\n")

  const date = new Date().toISOString().split("T")[0]
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-fortia-${date}.csv"`,
    },
  })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[export] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
