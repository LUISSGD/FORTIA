"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Bell, BellOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Status = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on"

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

async function getRegistration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" })
}

async function saveSubscription(sub: PushSubscription) {
  const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) })
  if (!res.ok) throw new Error("No se pudo guardar la suscripción")
}

/**
 * Activa/desactiva las notificaciones push en este dispositivo.
 * `variant="banner"` solo se muestra mientras no estén activadas.
 */
export default function PushToggle({ dark = false, variant = "row" }: { dark?: boolean; variant?: "row" | "banner" | "button" }) {
  const [status, setStatus] = useState<Status>("loading")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setStatus(ios && !standalone ? "ios-install" : "unsupported")
      }
      if (Notification.permission === "denied") return setStatus("denied")
      try {
        const reg = await getRegistration()
        const sub = await reg.pushManager.getSubscription()
        if (sub && Notification.permission === "granted") {
          await saveSubscription(sub).catch(() => {}) // re-sincroniza con el usuario actual
          setStatus("on")
        } else setStatus("off")
      } catch {
        setStatus("off")
      }
    })()
  }, [])

  async function enable() {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off")
        return
      }
      const { publicKey } = await (await fetch("/api/push")).json()
      if (!publicKey) throw new Error("Las notificaciones push no están configuradas en el servidor")
      const reg = await getRegistration()
      await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await Promise.race([
          reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("El navegador no respondió. Inténtalo de nuevo o usa Chrome/Safari actualizados.")), 20_000)),
        ]))
      await saveSubscription(sub)
      setStatus("on")
      toast.success("🔔 Notificaciones activadas en este dispositivo")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration("/")
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) })
        await sub.unsubscribe()
      }
      setStatus("off")
      toast.success("Notificaciones desactivadas")
    } finally {
      setBusy(false)
    }
  }

  if (status === "loading") return null

  const hint =
    status === "ios-install"
      ? "En iPhone: toca Compartir → “Agregar a inicio” y abre FORTIA desde el ícono para activar las notificaciones."
      : status === "denied"
        ? "Bloqueaste las notificaciones. Actívalas desde los ajustes del navegador para este sitio."
        : status === "unsupported"
          ? "Este navegador no admite notificaciones push."
          : null

  if (variant === "banner") {
    if (status === "on" || status === "unsupported" || status === "denied") return null
    return (
      <div className={cn("rounded-2xl border p-4", dark ? "bg-orange-500/10 border-orange-500/30" : "bg-orange-50 border-orange-200")}>
        <p className="font-bold">🔔 Activa las notificaciones</p>
        <p className={cn("text-xs mt-0.5", dark ? "text-zinc-400" : "text-gray-600")}>
          {hint ?? "Recibe en tu celular el entrenamiento del día, recordatorios y los mensajes de tu coach."}
        </p>
        {status === "off" && (
          <button onClick={enable} disabled={busy} className="mt-3 h-10 px-4 rounded-xl bg-orange-500 text-white text-sm font-bold flex items-center gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Activar
          </button>
        )}
      </div>
    )
  }

  if (variant === "button") {
    if (status !== "on" && status !== "off") return hint ? <span className="text-xs text-gray-500 max-w-60">{hint}</span> : null
    return (
      <button onClick={status === "on" ? disable : enable} disabled={busy} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50">
        {status === "on" ? <Bell className="h-4 w-4 text-orange-500" /> : <BellOff className="h-4 w-4" />}
        {status === "on" ? "Push activado" : "Activar push"}
      </button>
    )
  }

  return (
    <div className={cn("flex items-center gap-3 px-4 py-3.5", dark ? "" : "")}>
      {status === "on" ? <Bell className="h-4 w-4 text-orange-500" /> : <BellOff className="h-4 w-4 text-zinc-400" />}
      <div className="flex-1">
        <p className="text-sm">Notificaciones en este celular</p>
        {hint && <p className={cn("text-[11px]", dark ? "text-zinc-500" : "text-gray-500")}>{hint}</p>}
      </div>
      {(status === "on" || status === "off") && (
        <button
          onClick={status === "on" ? disable : enable}
          disabled={busy}
          aria-label="Notificaciones push"
          className={cn("relative h-7 w-12 rounded-full transition", status === "on" ? "bg-orange-500" : dark ? "bg-zinc-700" : "bg-gray-300")}
        >
          <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white transition-all", status === "on" ? "left-6" : "left-1")} />
        </button>
      )}
    </div>
  )
}
