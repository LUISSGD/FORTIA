import Link from "next/link"
import { cn } from "@/lib/utils"

// Primitivas de la app del cliente (tema oscuro).

export function Card({ children, className, href }: { children: React.ReactNode; className?: string; href?: string }) {
  const cls = cn("block rounded-2xl bg-zinc-900 border border-zinc-800/80 p-4", href && "active:scale-[0.99] transition", className)
  return href ? <Link href={href} className={cls}>{children}</Link> : <section className={cls}>{children}</section>
}

export function SectionTitle({ emoji, children, action }: { emoji?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-400">{emoji && <span className="mr-1.5">{emoji}</span>}{children}</h2>
      {action}
    </div>
  )
}

export function Bar({ value, max, className, color = "bg-orange-500" }: { value: number; max: number; className?: string; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className={cn("h-2 rounded-full bg-zinc-800 overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all", value > max * 1.08 && max > 0 ? "bg-red-500" : color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function CTA({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center justify-center h-12 rounded-xl bg-orange-500 text-white font-bold tracking-wide active:scale-[0.98] transition", className)}>
      {children}
    </Link>
  )
}

export function PageTitle({ title, subtitle, back }: { title: string; subtitle?: string; back?: string }) {
  return (
    <div className="mb-4">
      {back && <Link href={back} className="text-xs text-zinc-500">← Volver</Link>}
      <h1 className="text-2xl font-black tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-zinc-400">{subtitle}</p>}
    </div>
  )
}

export function Ring({ value, max, size = 72, stroke = 7, children, color = "#f97316" }: { value: number; max: number; size?: number; stroke?: number; children?: React.ReactNode; color?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : 0
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#27272a" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={value > max * 1.08 && max > 0 ? "#ef4444" : color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

export const darkInput = "w-full h-11 rounded-xl bg-zinc-800 border border-zinc-700 px-3 text-base text-white placeholder:text-zinc-500 outline-none focus:border-orange-500"
