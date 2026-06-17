import { Badge } from "@/components/ui/badge"
import { daysUntilExpiry, getRenewalStatus } from "@/lib/utils"

export default function RenewalBadge({ membershipEnd }: { membershipEnd: Date | string | null | undefined }) {
  const days = daysUntilExpiry(membershipEnd)
  const status = getRenewalStatus(days)

  if (status === "none") return <Badge variant="outline">Sin membresía</Badge>
  if (status === "expired") return <Badge className="bg-gray-500 text-white">Vencido</Badge>
  if (status === "urgent") return <Badge className="bg-red-500 text-white">{days} días</Badge>
  if (status === "warning") return <Badge className="bg-yellow-500 text-white">{days} días</Badge>
  return <Badge className="bg-green-500 text-white">{days} días</Badge>
}
