import { Pool } from "pg"
import * as dotenv from "dotenv"
dotenv.config({ path: ".env" })

const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL })

const data = [
  { concept: "Alquiler LOCAL",      currency: "USD", amount: 2920.50, status: "PENDIENTE" },
  { concept: "Harbiz Mensual",      currency: "PEN", amount: 678.81,  status: "PAGADO" },
  { concept: "Contabilidad",        currency: "PEN", amount: 450.00,  status: "PENDIENTE" },
  { concept: "Mantenimiento",       currency: "PEN", amount: 2000.00, status: "PENDIENTE" },
  { concept: "IGV Marzo",           currency: "PEN", amount: 1540.00, status: "PENDIENTE" },
  { concept: "IGV Fraccionamiento", currency: "PEN", amount: 393.00,  status: "PENDIENTE" },
  { concept: "PDT Renta",           currency: "PEN", amount: 300.00,  status: "PENDIENTE" },
  { concept: "AFP",                 currency: "PEN", amount: 400.00,  status: "PENDIENTE" },
  { concept: "Essalud",             currency: "PEN", amount: 311.00,  status: "PENDIENTE" },
  { concept: "Sueldo Piero",        currency: "PEN", amount: 1772.60, status: "PENDIENTE" },
  { concept: "Filtro Agua",         currency: "USD", amount: 47.20,   status: "PENDIENTE" },
  { concept: "APDAYC",              currency: "PEN", amount: 250.00,  status: "PENDIENTE" },
  { concept: "Luz del Sur",         currency: "PEN", amount: 300.00,  status: "PENDIENTE" },
  { concept: "Internet",            currency: "PEN", amount: 199.00,  status: "PENDIENTE" },
  { concept: "Harbiz Nutrición",    currency: "PEN", amount: 40.00,   status: "PENDIENTE" },
  { concept: "Damien Devolución",   currency: "PEN", amount: 1000.00, status: "PENDIENTE" },
  { concept: "Sueldo Julio",        currency: "PEN", amount: 1285.13, status: "PAGADO" },
  { concept: "Sueldo Leonardo",     currency: "PEN", amount: 1450.00, status: "PAGADO" },
  { concept: "Comisiones Julio",    currency: "PEN", amount: 650.00,  status: "PENDIENTE" },
  { concept: "Comisiones Leonardo", currency: "PEN", amount: 250.00,  status: "PAGADO" },
]

async function main() {
  const client = await pool.connect()
  try {
    const { rows } = await client.query(`SELECT COUNT(*) FROM "MonthlyExpense" WHERE month=7 AND year=2026`)
    if (Number(rows[0].count) > 0) {
      console.log(`Ya existen ${rows[0].count} gastos para julio 2026.`)
      return
    }
    const now = new Date().toISOString()
    for (const d of data) {
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
      const paidAt = d.status === "PAGADO" ? now : null
      await client.query(
        `INSERT INTO "MonthlyExpense" (id, concept, currency, amount, month, year, status, "paidAt", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id, d.concept, d.currency, d.amount, 7, 2026, d.status, paidAt, now, now]
      )
    }
    console.log(`✅ ${data.length} gastos corrientes de julio 2026 insertados.`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(console.error)
