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
]

// Rutas exactas bloqueadas para USER (la lista completa, no el formulario de creación)
const USER_BLOCKED_EXACT = [
  "/finances/income",
  "/finances/expenses",
]

export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isLoginPage = nextUrl.pathname === "/login"
      const isApiAuth = nextUrl.pathname.startsWith("/api/auth")

      if (isApiAuth) return true
      if (!isLoggedIn && !isLoginPage) return false

      if (isLoggedIn && isLoginPage) {
        const role = (auth?.user as { role?: string })?.role ?? "ADMIN"
        const dest = role === "USER" ? "/clients" : "/dashboard"
        return Response.redirect(new URL(dest, nextUrl))
      }

      // Block restricted routes for USER role
      const role = (auth?.user as { role?: string })?.role ?? "ADMIN"
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
