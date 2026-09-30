import { formatYmd } from "@/lib/coaching/dates"
import type { MembershipInfo } from "@/lib/coaching/personal-training"
import { cn } from "@/lib/utils"
import { Card, SectionTitle } from "./ui"

const TONE: Record<MembershipInfo["state"], string> = {
  none: "text-gray-400",
  expired: "text-red-500",
  urgent: "text-red-500",
  warning: "text-amber-600",
  active: "text-emerald-600",
}

export default function MembershipCard({ m, href }: { m: MembershipInfo; href?: string }) {
  return (
    <Card href={href}>
      <SectionTitle emoji="🎟️" action={href ? <span className="text-xs text-orange-500 font-semibold">VER</span> : null}>Mi membresía</SectionTitle>
      {m.state === "none" ? (
        <p className="text-sm text-gray-400">Sin membresía registrada.</p>
      ) : (
        <>
          <p className="font-bold text-gray-900">{m.planName ?? "Membresía"}</p>
          <p className={cn("text-sm font-semibold mt-0.5", TONE[m.state])}>
            {m.state === "expired"
              ? `Venció el ${formatYmd(m.end!, true)}`
              : m.daysLeft === 0
                ? "Vence hoy"
                : `Vence el ${formatYmd(m.end!, true)} · ${m.daysLeft} día${m.daysLeft === 1 ? "" : "s"}`}
          </p>
          {(m.state === "expired" || m.state === "urgent") && <p className="text-xs text-gray-400 mt-1">Habla con tu coach para renovar.</p>}
        </>
      )}
    </Card>
  )
}
