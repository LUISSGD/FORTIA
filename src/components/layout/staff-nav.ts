import { AlertCircle, ClipboardList, CreditCard, DollarSign, Dumbbell, FileText, Landmark, LayoutDashboard, ListOrdered, Salad, Sun, Target, TrendingUp, Users } from "lucide-react"
import { staffScreens } from "@/lib/staff-access"

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  today: Sun, clients: Users, training: Dumbbell, nutrition: Salad, finances: DollarSign, movements: ListOrdered, obligations: AlertCircle, plan: Target,
  projection: TrendingUp, expenses: ClipboardList, debts: Landmark, reports: FileText, memberships: CreditCard, dashboard: LayoutDashboard,
}

/** Pantallas que puede abrir el staff, con su ícono. */
export const staffNavItems = (modules: readonly string[]) =>
  staffScreens(modules).map((s) => ({ ...s, label: s.key === "finances" ? "Finanzas" : s.label, icon: ICONS[s.key] ?? FileText, exact: s.href === "/finances" }))

export function staffNavGroups(modules: readonly string[]) {
  const items = staffNavItems(modules)
  return (["Clientes", "Finanzas", "Otros"] as const)
    .map((label) => ({ label: label as string, items: items.filter((i) => i.group === label) }))
    .filter((g) => g.items.length)
}
