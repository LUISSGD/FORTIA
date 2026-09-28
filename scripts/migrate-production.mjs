// Aplica las migraciones pendientes de Prisma durante el build de PRODUCCIÓN en Vercel.
// Usa DIRECT_URL (o DATABASE_URL) según prisma.config.ts. En preview/local no hace nada.
// Si la migración falla, el build falla y Vercel mantiene la versión anterior en producción.
import { execSync } from "node:child_process"

if (process.env.VERCEL_ENV !== "production") {
  console.log("[migrate] No es producción; se omiten las migraciones.")
  process.exit(0)
}
console.log("[migrate] Estado de migraciones en producción:")
try {
  execSync("npx prisma migrate status", { stdio: "inherit" })
} catch {
  // status devuelve código ≠ 0 cuando hay migraciones pendientes; seguimos con deploy
}
execSync("npx prisma migrate deploy", { stdio: "inherit" })
console.log("[migrate] Migraciones aplicadas.")
