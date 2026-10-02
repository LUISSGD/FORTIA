import type { NextAuthConfig } from "next-auth"

// Rutas permitidas para TRAINER
const TRAINER_ALLOWED_PREFIXES = [
  "/trainer",
  "/api/trainer",
  "/api/auth",
  "/login",
]

// Rutas permitidas para NUTRITIONIST
const NUTRITIONIST_ALLOWED_PREFIXES = [
  "/nutrition",
  "/coaching/nutrition",  // acceso al builder de planes nutricionales
  "/api/nutrition",
  "/api/coaching/meal-plans",
  "/api/coaching/foods",
  "/api/auth",
  "/login",
]

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

const PUBLIC_FILES = ["/sw.js", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-icon.png", "/logo.png"]

// El rol CLIENT (clientes de coaching) solo accede a su app móvil
const CLIENT_ALLOWED_PREFIXES = ["/app", "/api/app", "/api/push", "/api/auth", "/login", "/manifest.webmanifest", "/logo.png", "/icon-192.png", "/icon-512.png", "/apple-icon.png"]

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
      // Webhook de Mercado Pago: valida la firma dentro del handler
      if (nextUrl.pathname === "/api/mercadopago/webhook") return true
      // Manifest e íconos de la PWA deben ser públicos para poder instalar la app
      if (PUBLIC_FILES.includes(nextUrl.pathname)) return true
      if (!isLoggedIn && !isLoginPage) return false

      if (isLoggedIn && isLoginPage) {
        const role = (auth?.user as { role?: string })?.role ?? "ADMIN"
        const dest = role === "CLIENT" ? "/app" : role === "USER" ? "/clients" : role === "NUTRITIONIST" ? "/nutrition" : role === "TRAINER" ? "/trainer/agenda" : "/dashboard"
        return Response.redirect(new URL(dest, nextUrl))
      }

      const role = (auth?.user as { role?: string })?.role ?? "ADMIN"

      if (role === "TRAINER") {
        const path = nextUrl.pathname
        const allowed = TRAINER_ALLOWED_PREFIXES.some(r => path === r || path.startsWith(r + "/"))
        if (allowed) return true
        if (path.startsWith("/api/")) return Response.json({ error: "Sin permisos" }, { status: 403 })
        return Response.redirect(new URL("/trainer/agenda", nextUrl))
      }

      if (role === "NUTRITIONIST") {
        const path = nextUrl.pathname
        const allowed = NUTRITIONIST_ALLOWED_PREFIXES.some(r => path === r || path.startsWith(r + "/"))
        if (allowed) return true
        if (path.startsWith("/api/")) return Response.json({ error: "Sin permisos" }, { status: 403 })
        return Response.redirect(new URL("/nutrition", nextUrl))
      }

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

      // El nutricionista ya fue redirigido arriba, aquí solo llegan ADMIN y USER


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
