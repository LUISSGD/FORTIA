import type { NextAuthConfig } from "next-auth"

// Rutas bloqueadas para USER (exact prefix match, except where noted)
const USER_BLOCKED_PREFIXES = [
  "/dashboard",
  "/debts",
  "/classes",
  "/memberships",
  "/finances/reports",
  "/finances/monthly-expenses",
  "/finances/pending-accumulated",
  "/settings",
  "/coaching",
]

const PUBLIC_FILES = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-icon.png", "/logo.png"]

// El rol CLIENT (clientes de coaching) solo accede a su app móvil
const CLIENT_ALLOWED_PREFIXES = ["/app", "/api/app", "/api/auth", "/login", "/manifest.webmanifest", "/logo.png", "/icon-192.png", "/icon-512.png", "/apple-icon.png"]

// Rutas exactas bloqueadas para USER (la lista completa, no el formulario de creación)
const USER_BLOCKED_EXACT = [
  "/finances/income",
  "/finances/expenses",
]

export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { nextUrl } = request
      const isLoggedIn = !!auth?.user
      const isLoginPage = nextUrl.pathname === "/login"
      const isApiAuth = nextUrl.pathname.startsWith("/api/auth")

      if (isApiAuth) return true
      // Cron de automatizaciones: se autentica con CRON_SECRET dentro del handler
      if (nextUrl.pathname === "/api/coaching/automations/run" && request.method === "GET") return true
      // Manifest e íconos de la PWA deben ser públicos para poder instalar la app
      if (PUBLIC_FILES.includes(nextUrl.pathname)) return true
      if (!isLoggedIn && !isLoginPage) return false

      if (isLoggedIn && isLoginPage) {
        const role = (auth?.user as { role?: string })?.role ?? "ADMIN"
        const dest = role === "CLIENT" ? "/app" : role === "USER" ? "/clients" : "/dashboard"
        return Response.redirect(new URL(dest, nextUrl))
      }

      const role = (auth?.user as { role?: string })?.role ?? "ADMIN"

      if (role === "CLIENT") {
        const path = nextUrl.pathname
        const allowed = CLIENT_ALLOWED_PREFIXES.some(r => path === r || path.startsWith(r + "/"))
        if (allowed) return true
        if (path.startsWith("/api/")) return Response.json({ error: "Sin permisos" }, { status: 403 })
        return Response.redirect(new URL("/app", nextUrl))
      }

      // La app del cliente no es para el staff
      if (nextUrl.pathname === "/app" || nextUrl.pathname.startsWith("/app/")) {
        return Response.redirect(new URL(role === "USER" ? "/clients" : "/coaching", nextUrl))
      }

      // Block restricted routes for USER role
      if (role === "USER") {
        const path = nextUrl.pathname
        const blockedByPrefix = USER_BLOCKED_PREFIXES.some(r => path.startsWith(r))
        const blockedByExact = USER_BLOCKED_EXACT.includes(path)
        if (blockedByPrefix || blockedByExact) {
          return Response.redirect(new URL("/clients", nextUrl))
        }
      }

      return true
    },
  },
}
