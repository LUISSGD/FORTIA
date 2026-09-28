import Link from "next/link"
import { MessageCircle } from "lucide-react"
import type { ClientOverview } from "@/lib/coaching/stats"
import { StatusDot } from "@/components/coaching/kit"

export default function AttentionList({ clients }: { clients: ClientOverview[] }) {
  if (!clients.length) return <p className="text-sm text-gray-500 py-4 text-center">🎉 Todos tus clientes están al día.</p>
  return (
    <ul className="divide-y divide-gray-100">
      {clients.map((c) => (
        <li key={c.id} className="py-3 flex items-start gap-3">
          <StatusDot level={c.level} />
          <div className="flex-1 min-w-0">
            <Link href={`/coaching/clients/${c.id}`} className="font-semibold text-sm text-gray-900 hover:text-orange-600">
              {c.name}
            </Link>
            <ul className="mt-0.5 space-y-0.5">
              {c.alerts.map((a, i) => (
                <li key={i} className={`text-xs ${a.level === "red" ? "text-red-600" : "text-amber-700"}`}>
                  • {a.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-1 shrink-0">
            <Link href={`/coaching/messages?c=${c.id}`} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="Escribir por el chat">
              <MessageCircle className="h-4 w-4" />
            </Link>
            {c.phone && (
              <a
                href={`https://wa.me/${c.phone.replace(/\D/g, "").replace(/^(?!51)/, "51")}?text=${encodeURIComponent(`¡Hola ${c.firstName}! ¿Cómo vas? 💪`)}`}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 text-xs font-semibold"
                title="WhatsApp"
              >
                WA
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
