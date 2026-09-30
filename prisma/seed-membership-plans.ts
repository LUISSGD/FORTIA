import { Pool } from "pg"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env" })

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const plans = [
  // ── HEAD COACH · ELITE ATHLETE ──────────────────────────────
  { name: "Elite Athlete — Head Coach — 8 sesiones (Opening)",   days: 28, price: 780,  desc: "Head Coach · Elite Athlete · Opening · 8 clases / 4 sem." },
  { name: "Elite Athlete — Head Coach — 12 sesiones (Opening)",  days: 28, price: 1050, desc: "Head Coach · Elite Athlete · Opening · 12 clases / 4 sem." },
  { name: "Elite Athlete — Head Coach — 16 sesiones (Opening)",  days: 28, price: 1350, desc: "Head Coach · Elite Athlete · Opening · 16 clases / 4 sem." },
  { name: "Elite Athlete — Head Coach — 8 sesiones (Regular)",   days: 28, price: 920,  desc: "Head Coach · Elite Athlete · Regular · 8 clases / 4 sem." },
  { name: "Elite Athlete — Head Coach — 12 sesiones (Regular)",  days: 28, price: 1200, desc: "Head Coach · Elite Athlete · Regular · 12 clases / 4 sem." },
  { name: "Elite Athlete — Head Coach — 16 sesiones (Regular)",  days: 28, price: 1520, desc: "Head Coach · Elite Athlete · Regular · 16 clases / 4 sem." },
  // ── HEAD COACH · ELITE ATHLETE PAREJAS ──────────────────────
  { name: "Elite Athlete Parejas — Head Coach — 8 ses. (Opening)",   days: 28, price: 1050, desc: "Head Coach · Elite Athlete Parejas · Opening · 8 clases / 4 sem." },
  { name: "Elite Athlete Parejas — Head Coach — 12 ses. (Opening)",  days: 28, price: 1200, desc: "Head Coach · Elite Athlete Parejas · Opening · 12 clases / 4 sem." },
  { name: "Elite Athlete Parejas — Head Coach — 16 ses. (Opening)",  days: 28, price: 1520, desc: "Head Coach · Elite Athlete Parejas · Opening · 16 clases / 4 sem." },
  { name: "Elite Athlete Parejas — Head Coach — 8 ses. (Regular)",   days: 28, price: 1200, desc: "Head Coach · Elite Athlete Parejas · Regular · 8 clases / 4 sem." },
  { name: "Elite Athlete Parejas — Head Coach — 12 ses. (Regular)",  days: 28, price: 1440, desc: "Head Coach · Elite Athlete Parejas · Regular · 12 clases / 4 sem." },
  { name: "Elite Athlete Parejas — Head Coach — 16 ses. (Regular)",  days: 28, price: 1760, desc: "Head Coach · Elite Athlete Parejas · Regular · 16 clases / 4 sem." },
  // ── TEAM FORTIA · ELITE ATHLETE ─────────────────────────────
  { name: "Elite Athlete — Team Fortia — 8 sesiones",  days: 28, price: 840,  desc: "Team Fortia · Elite Athlete · 8 clases / 4 sem." },
  { name: "Elite Athlete — Team Fortia — 12 sesiones", days: 28, price: 1050, desc: "Team Fortia · Elite Athlete · 12 clases / 4 sem." },
  { name: "Elite Athlete — Team Fortia — 16 sesiones", days: 28, price: 1350, desc: "Team Fortia · Elite Athlete · 16 clases / 4 sem." },
  // ── TEAM FORTIA · ELITE ATHLETE PAREJAS ─────────────────────
  { name: "Elite Athlete Parejas — Team Fortia — 8 ses.",  days: 28, price: 1050, desc: "Team Fortia · Elite Athlete Parejas · 8 clases / 4 sem." },
  { name: "Elite Athlete Parejas — Team Fortia — 12 ses.", days: 28, price: 1200, desc: "Team Fortia · Elite Athlete Parejas · 12 clases / 4 sem." },
  { name: "Elite Athlete Parejas — Team Fortia — 16 ses.", days: 28, price: 1520, desc: "Team Fortia · Elite Athlete Parejas · 16 clases / 4 sem." },
  // ── PRIME ATHLETE ────────────────────────────────────────────
  { name: "Prime Athlete — Atleta — Mensual",       days: 30,  price: 450,  desc: "Programa Prime Athlete · Tarifa Atleta · 30 días" },
  { name: "Prime Athlete — Atleta — Trimestral",    days: 90,  price: 1080, desc: "Programa Prime Athlete · Tarifa Atleta · 90 días" },
  { name: "Prime Athlete — Corporativa — Mensual",  days: 30,  price: 520,  desc: "Programa Prime Athlete · Tarifa Corporativa · 30 días" },
  { name: "Prime Athlete — Corporativa — Trimestral", days: 90, price: 1250, desc: "Programa Prime Athlete · Tarifa Corporativa · 90 días" },
  { name: "Prime Athlete — Regular — Mensual",      days: 30,  price: 600,  desc: "Programa Prime Athlete · Tarifa Regular · 30 días" },
  { name: "Prime Athlete — Regular — Trimestral",   days: 90,  price: 1530, desc: "Programa Prime Athlete · Tarifa Regular · 90 días" },
  { name: "Prime Athlete — Regular — Semestral",    days: 180, price: 2880, desc: "Programa Prime Athlete · Tarifa Regular · 180 días" },
  { name: "Prime Athlete — Opening — Mensual",      days: 30,  price: 520,  desc: "Programa Prime Athlete · Tarifa Opening · 30 días" },
  { name: "Prime Athlete — Opening — Trimestral",   days: 90,  price: 1350, desc: "Programa Prime Athlete · Tarifa Opening · 90 días" },
  // ── FORTIA X ─────────────────────────────────────────────────
  { name: "Fortia X — Mensual",    days: 30, price: 400, desc: "Programa Fortia X · 30 días" },
  { name: "Fortia X — Trimestral", days: 90, price: 960, desc: "Programa Fortia X · 90 días" },
]

async function main() {
  const client = await pool.connect()
  try {
    // Deactivate all existing plans
    await client.query(`UPDATE "MembershipPlan" SET "isActive" = false`)
    console.log("✓ Planes anteriores desactivados")

    const now = new Date().toISOString()
    let inserted = 0
    for (const p of plans) {
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
      await client.query(
        `INSERT INTO "MembershipPlan" (id, name, "durationDays", price, description, "isActive", "createdAt")
         VALUES ($1, $2, $3, $4, $5, true, $6)`,
        [id, p.name, p.days, p.price, p.desc, now]
      )
      inserted++
    }
    console.log(`✅ ${inserted} planes insertados.`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(console.error)
