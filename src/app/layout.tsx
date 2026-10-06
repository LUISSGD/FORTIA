import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "next-auth/react"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "FORTIA — Gestión de Gimnasio",
  description: "Sistema de gestión para el gimnasio FORTIA",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          {children}
          {/* En el celular el aviso baja del todo: respeta la barra de estado del iPhone (safe-area) y el header de la app */}
          <Toaster
            richColors
            position="top-right"
            offset={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
            mobileOffset={{ top: "calc(env(safe-area-inset-top) + 64px)", left: "12px", right: "12px" }}
          />
        </SessionProvider>
      </body>
    </html>
  )
}
