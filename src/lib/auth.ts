import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { authConfig, PUBLIC_FILES } from "@/lib/auth.config"
import { staffCanOpen, staffHome } from "@/lib/staff-access"
import { getStaffModules } from "@/lib/staff-access-server"

// Rutas que no dependen de los accesos: archivos públicos y las que validan por su cuenta
const OPEN_TO_STAFF = [...PUBLIC_FILES, "/api/public/leads", "/api/mercadopago/webhook", "/api/coaching/automations/run"]

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user) return null

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isValid) return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    // Reglas por rol y, para el staff, sus accesos actuales: todo lo que no tenga activo queda cerrado
    async authorized(params) {
      const base = await authConfig.callbacks!.authorized!(params)
      const user = params.auth?.user as { id?: string; role?: string } | undefined
      if (base !== true || user?.role !== "USER") return base
      const { pathname } = params.request.nextUrl
      if (OPEN_TO_STAFF.includes(pathname) || pathname.startsWith("/api/auth/")) return true
      const modules = await getStaffModules(user.id)
      if (staffCanOpen(modules, pathname, params.request.method)) return true
      if (pathname.startsWith("/api/")) return Response.json({ error: "Sin permisos" }, { status: 403 })
      return Response.redirect(new URL(staffHome(modules), params.request.nextUrl))
    },
    jwt({ token, user }) {
      if (user) { token.id = user.id; token.role = user.role }
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      session.user.role = (token.role as string) ?? "ADMIN"
      return session
    },
  },
})
