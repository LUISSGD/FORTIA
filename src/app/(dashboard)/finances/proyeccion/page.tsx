"use client"

import { useState, useEffect, useCallback } from "react"
import Header from "@/components/layout/Header"
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
  willSkip: boolean
}

interface ProjectionData {
  clients: ClientRow[]
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

export default function ProyeccionPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [data, setData] = useState<ProjectionData | null>(null)
  const [loading, setLoading] = useState(true)

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
    // Optimistic update
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
    <>
      <Header title="Proyección de renovaciones" />
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
                    S/ {data.projectedTotal.toFixed(2)}
                  </p>
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
                {skippedClients.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={5} className="px-4 py-2 bg-gray-50 text-xs text-gray-400 font-medium uppercase tracking-wide">
                        No renuevan
                      </td>
                    </tr>
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
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
