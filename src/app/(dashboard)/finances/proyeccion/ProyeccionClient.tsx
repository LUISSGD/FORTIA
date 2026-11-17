"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, TrendingUp, Users, XCircle } from "lucide-react"
import { addMonths, subMonths } from "date-fns"
import Link from "next/link"

interface ClientRow {
  id: string
  name: string
  membershipEnd: string
  planName: string
  price: number
  /** lastPayment = lo que pagó la última vez; plan = precio de lista (sin pagos registrados) */
  priceSource?: "lastPayment" | "plan"
  willSkip: boolean
}

interface BalanceRow {
  paymentId: string
  clientId: string
  name: string
  concept: string
  amount: number
  dueDate: string | null
  overdue: boolean
}

interface ProjectionData {
  clients: ClientRow[]
  /** Saldos por cobrar de pagos parciales (vencen en el mes o ya vencidos, si es el mes actual) */
  balances: BalanceRow[]
  balancesTotal: number
  projectedTotal: number
  skippedTotal: number
  monthLabel: string
  yearMonth: string
}

function toYearMonth(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function fmtDate(s: string) {
  const d = new Date(s)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function ProyeccionClient() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [data, setData] = useState<ProjectionData | null>(null)
  const [loading, setLoading] = useState(true)
  // "No renuevan" va al final y cerrado: la pantalla se enfoca en lo que hay que cobrar
  const [showSkipped, setShowSkipped] = useState(false)

  const yearMonth = toYearMonth(currentDate)

  const load = useCallback(async (ym: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finances/renewal-projection?month=${ym}`)
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(yearMonth) }, [yearMonth, load])

  async function toggleSkip(clientId: string, currentSkip: boolean) {
    const newSkip = !currentSkip
    setData((prev) => {
      if (!prev) return prev
      const clients = prev.clients.map((c) =>
        c.id === clientId ? { ...c, willSkip: newSkip } : c
      )
      const projectedTotal = clients.filter((c) => !c.willSkip).reduce((s, c) => s + c.price, 0)
      const skippedTotal = clients.filter((c) => c.willSkip).reduce((s, c) => s + c.price, 0)
      return { ...prev, clients, projectedTotal, skippedTotal }
    })

    await fetch("/api/finances/renewal-projection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, yearMonth, skip: newSkip }),
    })
  }

  const activeClients = data?.clients.filter((c) => !c.willSkip) ?? []
  const skippedClients = data?.clients.filter((c) => c.willSkip) ?? []

  return (
    <main className="flex-1 p-3 md:p-6 max-w-4xl mx-auto">
      {/* Month selector */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentDate((d) => subMonths(d, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">
          {new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(currentDate)}
        </h2>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentDate((d) => addMonths(d, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-green-100 p-2.5 rounded-full">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Proyectado</p>
                <p className="text-xl font-bold text-green-600">
                  S/ {(data.projectedTotal + (data.balancesTotal ?? 0)).toFixed(2)}
                </p>
                {(data.balancesTotal ?? 0) > 0 && (
                  <p className="text-[11px] text-gray-500">
                    Renovaciones S/ {data.projectedTotal.toFixed(2)} + saldos S/ {data.balancesTotal.toFixed(2)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-blue-100 p-2.5 rounded-full">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Renuevan</p>
                <p className="text-xl font-bold text-blue-600">
                  {activeClients.length}{" "}
                  <span className="text-sm font-normal text-gray-400">
                    de {data.clients.length}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-gray-100 p-2.5 rounded-full">
                <XCircle className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">No renuevan</p>
                <p className="text-xl font-bold text-gray-500">
                  S/ {data.skippedTotal.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-10">Cargando...</p>
      ) : !data || data.clients.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">
          Ningún cliente vence este mes.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Vence</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Precio</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">No renueva</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {activeClients.map((c) => (
                <tr key={c.id} className="bg-white hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${c.id}`} className="font-medium hover:text-orange-600">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.planName}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{fmtDate(c.membershipEnd)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">
                    S/ {c.price.toFixed(2)}
                    <span className="block text-[10px] font-normal text-gray-400">{c.priceSource === "plan" ? "precio del plan" : "último pago"}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleSkip(c.id, c.willSkip)}
                      className="w-8 h-5 rounded-full bg-gray-200 relative transition-colors hover:bg-gray-300"
                      aria-label="Marcar como no renueva"
                    >
                      <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Saldos por cobrar (pagos parciales) */}
      {!loading && data && (data.balances?.length ?? 0) > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Saldos por cobrar · {data.balances.length} · S/ {data.balancesTotal.toFixed(2)}
          </h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Pago</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Vence</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.balances.map((b) => (
                  <tr key={b.paymentId} className="bg-white hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/coaching/clients/${b.clientId}?tab=payments`} className="font-medium hover:text-orange-600">
                        {b.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{b.concept}</td>
                    <td className={`px-4 py-3 text-center ${b.overdue ? "text-red-600 font-medium" : "text-gray-600"}`}>
                      {b.dueDate ? b.dueDate.slice(8, 10) + "/" + b.dueDate.slice(5, 7) : "—"}
                      {b.overdue && <span className="block text-[10px]">vencido</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">S/ {b.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* No renuevan: al final, plegado */}
      {!loading && skippedClients.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowSkipped((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-500 hover:bg-gray-100"
          >
            <span className="font-medium">No renuevan · {skippedClients.length} · S/ {data!.skippedTotal.toFixed(2)}</span>
            <span className="text-xs">{showSkipped ? "Ocultar ▲" : "Ver ▼"}</span>
          </button>
          {showSkipped && (
            <div className="mt-2 overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {skippedClients.map((c) => (
                  <tr key={c.id} className="bg-gray-50 opacity-60">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${c.id}`} className="font-medium line-through text-gray-400">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs line-through">{c.planName}</td>
                    <td className="px-4 py-3 text-center text-gray-400 line-through">{fmtDate(c.membershipEnd)}</td>
                    <td className="px-4 py-3 text-right text-gray-400 line-through">
                      S/ {c.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleSkip(c.id, c.willSkip)}
                        className="w-8 h-5 rounded-full bg-orange-500 relative transition-colors hover:bg-orange-400"
                        aria-label="Reactivar renovación"
                      >
                        <span className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform" />
                      </button>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
