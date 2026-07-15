import { Pool } from "pg"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env" })

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const data = [
  { concept: "PDT Detracción Alquileres (IGV a Favor)", month: 1, year: 2026, currency: "PEN", amount: 1060.00 },
  { concept: "PDT Detracción Alquileres (IGV a Favor)", month: 2, year: 2026, currency: "PEN", amount: 1060.00 },
  { concept: "PDT Detracción Alquileres (IGV a Favor)", month: 3, year: 2026, currency: "PEN", amount: 1060.00 },
  { concept: "PDT Detracción Alquileres (IGV a Favor)", month: 4, year: 2026, currency: "PEN", amount: 1060.00 },
  { concept: "PDT Detracción Alquileres (IGV a Favor)", month: 5, year: 2026, currency: "PEN", amount: 1060.00 },
  { concept: "PDT Detracción Alquileres (IGV a Favor)", month: 6, year: 2026, currency: "PEN", amount: 1060.00 },
  { concept: "Contabilidad",       month: 5, year: 2026, currency: "PEN", amount: 450.00 },
  { concept: "Contabilidad",       month: 6, year: 2026, currency: "PEN", amount: 450.00 },
  { concept: "Mantenimiento LOCAL", month: 5, year: 2026, currency: "PEN", amount: 1962.52 },
  { concept: "Mantenimiento LOCAL", month: 6, year: 2026, currency: "PEN", amount: 1998.29 },
  { concept: "Gabo - Fortia Academy", month: 6, year: 2026, currency: "PEN", amount: 700.00 },
  { concept: "Gabo - Gasto Mensual",  month: 6, year: 2026, currency: "PEN", amount: 2500.00 },
  { concept: "AFP - Vcto 10 de Julio", month: 6, year: 2026, currency: "PEN", amount: 400.00 },
  { concept: "Filtro Agua",           month: 6, year: 2026, currency: "USD", amount: 47.20 },
]

async function main() {
  const client = await pool.connect()
  try {
    const now = new Date().toISOString()
    let inserted = 0
    for (const d of data) {
      const { rows } = await client.query(
        `SELECT id FROM "MonthlyExpense" WHERE concept=$1 AND month=$2 AND year=$3`,
        [d.concept, d.month, d.year]
      )
      if (rows.length > 0) { console.log(`Ya existe: ${d.concept} - ${d.month}/${d.year}`); continue }
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
      await client.query(
        `INSERT INTO "MonthlyExpense" (id, concept, currency, amount, month, year, status, "paidAt", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id, d.concept, d.currency, d.amount, d.month, d.year, "PENDIENTE", null, now, now]
      )
      inserted++
    }
    console.log(`✅ ${inserted} gastos pendientes acumulados insertados.`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(console.error)
