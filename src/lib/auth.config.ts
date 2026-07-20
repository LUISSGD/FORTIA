import type { NextAuthConfig } from "next-auth"

const USER_BLOCKED = [
  "/dashboard",
  "/debts",
  "/classes",
  "/memberships",
  "/finances/reports",
  "/finances/income",
  "/finances/expenses",
  "/finances/monthly-expenses",
  "/finances/pending-accumulated",
  "/settings",
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
        const blocked = USER_BLOCKED.some(r => nextUrl.pathname.startsWith(r))
        if (blocked) return Response.redirect(new URL("/clients", nextUrl))
      }

      return true
    },
  },
}
