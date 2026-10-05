"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

/**
 * Chat a pantalla completa en la app del cliente (como WhatsApp): tapa el header y el menú inferior,
 * y se ajusta al alto visible real. En iPhone, al abrir el teclado el alto visible se reduce
 * (visualViewport), así la caja de texto queda siempre encima del teclado y no "salta".
 */
export default function ChatScreen({ title, subtitle, back, children }: { title: string; subtitle?: string; back: string; children: React.ReactNode }) {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    const html = document.documentElement
    const prev = { overflow: document.body.style.overflow, overscroll: html.style.overscrollBehavior }
    // Evita que la página de fondo se desplace mientras el chat está abierto
    document.body.style.overflow = "hidden"
    html.style.overscrollBehavior = "none"
    if (!vv) return () => { document.body.style.overflow = prev.overflow; html.style.overscrollBehavior = prev.overscroll }
    const update = () => setBox({ top: vv.offsetTop, height: vv.height })
    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
      document.body.style.overflow = prev.overflow
      html.style.overscrollBehavior = prev.overscroll
    }
  }, [])

  return (
    <div
      className="fixed inset-x-0 z-[60] bg-gray-50 flex flex-col"
      style={box ? { top: box.top, height: box.height } : { top: 0, height: "100dvh" }}
    >
      <div className="bg-white border-b border-gray-100" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <Link href={back} className="p-1 -ml-1 text-gray-500 hover:text-gray-800" aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="font-black leading-tight truncate">{title}</p>
            {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 w-full max-w-md mx-auto flex flex-col">{children}</div>
    </div>
  )
}
