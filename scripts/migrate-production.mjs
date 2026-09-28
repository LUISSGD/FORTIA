// Aplica los cambios de base de datos durante el build de PRODUCCIÓN en Vercel.
// En preview/local no hace nada. Si algo falla, el build falla y Vercel mantiene la versión anterior.
//
// 1) Intenta `prisma migrate deploy` (camino normal).
// 2) Si falla (p. ej. la base se creó sin historial de migraciones: P3005, o hay una migración
//    marcada como fallida: P3009/P3018), calcula el SQL exacto entre la base y el schema y lo aplica
//    solo si no contiene instrucciones que borren o alteren datos (DROP TABLE/COLUMN, cambios de tipo…).
// 3) Después marca todas las migraciones como aplicadas para normalizar el historial.
import { execSync } from "node:child_process"
import { readdirSync, statSync } from "node:fs"

if (process.env.VERCEL_ENV !== "production") {
  console.log("[migrate] No es producción; se omiten las migraciones.")
  process.exit(0)
}

function run(cmd) {
  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    return { ok: true, out }
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}\n${e.stderr ?? ""}` }
  }
}

console.log("[migrate] 1/3 prisma migrate deploy")
const deploy = run("npx prisma migrate deploy")
console.log(deploy.out)
if (deploy.ok) {
  console.log("[migrate] ✅ Migraciones aplicadas.")
  process.exit(0)
}

const code = deploy.out.match(/P\d{4}/)?.[0] ?? "desconocido"
console.log(`[migrate] ⚠️ migrate deploy falló (código ${code}). Se aplican solo los cambios que agregan, sin tocar datos.`)

console.log("[migrate] 2/3 Calculando los cambios exactos respecto al schema")
const diff = run("npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script")
if (!diff.ok) {
  console.log(diff.out)
  console.error("[migrate] ❌ No se pudo calcular la diferencia. No se modificó nada.")
  process.exit(1)
}
const sql = diff.out
// Instrucciones que podrían borrar o alterar datos existentes → abortar
const DANGEROUS = [/\bDROP\s+TABLE\b/i, /\bDROP\s+COLUMN\b/i, /\bALTER\s+COLUMN\s+"[^"]+"\s+(SET\s+DATA\s+)?TYPE\b/i, /\bTRUNCATE\b/i, /\bDELETE\s+FROM\b/i, /\bDROP\s+TYPE\b/i, /\bRENAME\b/i]
const statements = sql.split(/;\s*\n/).map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)
const risky = statements.filter((st) => DANGEROUS.some((re) => re.test(st)))
console.log(`[migrate] ${statements.length} instrucciones SQL a aplicar:`)
statements.forEach((st) => console.log(`[migrate]   ${st.split("\n")[0].slice(0, 140)}`))
if (risky.length) {
  console.error("[migrate] ❌ Hay cambios que podrían borrar datos; no se aplica nada:")
  risky.forEach((st) => console.error(`[migrate]   ${st.split("\n")[0]}`))
  process.exit(1)
}
if (statements.length) {
  try {
    execSync("npx prisma db execute --stdin", { input: sql, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] })
  } catch {
    console.error("[migrate] ❌ Falló la aplicación del SQL. Revisa el error de arriba.")
    process.exit(1)
  }
  console.log("[migrate] ✅ Tablas y columnas nuevas creadas.")
} else {
  console.log("[migrate] La base ya coincide con el schema.")
}

console.log("[migrate] 3/3 Normalizando el historial de migraciones")
const dir = "prisma/migrations"
const names = readdirSync(dir).filter((n) => statSync(`${dir}/${n}`).isDirectory()).sort()
for (const name of names) {
  let r = run(`npx prisma migrate resolve --applied ${name}`)
  if (!r.ok && /failed state|P3008|rolled.?back/i.test(r.out) && !/already recorded as applied/i.test(r.out)) {
    run(`npx prisma migrate resolve --rolled-back ${name}`)
    r = run(`npx prisma migrate resolve --applied ${name}`)
  }
  console.log(`[migrate]   ${name}: ${r.ok ? "marcada como aplicada" : /already/i.test(r.out) ? "ya estaba aplicada" : "sin cambios"}`)
}
console.log("[migrate] ✅ Base de datos actualizada.")
