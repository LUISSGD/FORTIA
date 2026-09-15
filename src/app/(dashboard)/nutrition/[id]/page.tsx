import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import Header from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Plus, Phone, Mail, Calendar, AlertCircle, CheckCircle, Edit, Dumbbell } from "lucide-react"
import DeleteButton from "@/components/ui/DeleteButton"
import NutritionClientDetail from "./NutritionClientDetail"

export const dynamic = "force-dynamic"

type PageProps = { params: Promise<{ id: string }> }

const GOAL_LABELS: Record<string, string> = {
  PERDIDA_PESO: "Pérdida de peso",
  GANANCIA_MUSCULAR: "Ganancia muscular",
  MANTENIMIENTO: "Mantenimiento",
  DEFINICION: "Definición",
  SALUD: "Salud general",
}

const ACTIVITY_LABELS: Record<string, string> = {
  SEDENTARIO: "Sedentario",
  LIGERO: "Ligero",
  MODERADO: "Moderado",
  ACTIVO: "Activo",
  MUY_ACTIVO: "Muy activo",
}

export default async function NutritionClientPage({ params }: PageProps) {
  const { id } = await params
  const client = await prisma.nutritionClient.findUnique({
    where: { id },
    include: {
      consultations: { orderBy: { date: "desc" } },
    },
  })
  if (!client) notFound()

  const serialized = {
    ...client,
    birthDate: client.birthDate?.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    consultations: client.consultations.map((c) => ({
      ...c,
      date: c.date.toISOString(),
      nextAppointment: c.nextAppointment?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  }

  const latestConsultation = client.consultations[0] ?? null

  const age = client.birthDate
    ? Math.floor((Date.now() - client.birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  const bmi = latestConsultation?.weight && latestConsultation?.height
    ? (latestConsultation.weight / Math.pow(latestConsultation.height / 100, 2)).toFixed(1)
    : null

  return (
    <>
      <Header title={`${client.firstName} ${client.lastName}`} />
      <main className="flex-1 p-3 md:p-6 space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link href="/nutrition">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
          </Link>
          <div className="flex gap-2">
            <Link href={`/nutrition/${id}/edit`}>
              <Button variant="outline" size="sm" className="gap-1">
                <Edit className="h-3.5 w-3.5" />
                Editar
              </Button>
            </Link>
            <Link href={`/nutrition/${id}/consulta`}>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-2">
                <Plus className="h-4 w-4" />
                Nueva consulta
              </Button>
            </Link>
          </div>
        </div>

        {/* Profile + stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Profile card */}
          <Card className="md:col-span-2">
            <CardContent className="pt-5">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl font-bold text-green-700">
                    {client.firstName[0]}{client.lastName[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-gray-800">
                      {client.firstName} {client.lastName}
                    </h2>
                    {client.clientId && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                        <Dumbbell className="h-3 w-3" />
                        Alumno Fortia
                      </span>
                    )}
                    {!client.isActive && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
                    {age && <span>{age} años • {client.gender === "M" ? "Masculino" : client.gender === "F" ? "Femenino" : ""}</span>}
                    {client.phone && (
                      <a href={`tel:${client.phone}`} className="flex items-center gap-1 hover:text-green-600">
                        <Phone className="h-3.5 w-3.5" />{client.phone}
                      </a>
                    )}
                    {client.email && (
                      <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-green-600">
                        <Mail className="h-3.5 w-3.5" />{client.email}
                      </a>
                    )}
                  </div>
                  {client.currentGoal && (
                    <div className="mt-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        {GOAL_LABELS[client.currentGoal] ?? client.currentGoal}
                      </span>
                      {client.physicalActivityLevel && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {ACTIVITY_LABELS[client.physicalActivityLevel] ?? client.physicalActivityLevel}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-gray-600">
                    {client.medicalConditions && (
                      <div><span className="font-medium text-gray-500">Condiciones:</span> {client.medicalConditions}</div>
                    )}
                    {client.allergies && (
                      <div><span className="font-medium text-gray-500">Alergias:</span> {client.allergies}</div>
                    )}
                    {client.foodPreferences && (
                      <div><span className="font-medium text-gray-500">Preferencias:</span> {client.foodPreferences}</div>
                    )}
                    {client.occupation && (
                      <div><span className="font-medium text-gray-500">Ocupación:</span> {client.occupation}</div>
                    )}
                    {client.referredBy && (
                      <div><span className="font-medium text-gray-500">Referido por:</span> {client.referredBy}</div>
                    )}
                  </div>
                  {client.notes && (
                    <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">{client.notes}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current metrics */}
          <Card>
            <CardHeader><CardTitle className="text-sm text-gray-500">Métricas actuales</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {latestConsultation ? (
                <>
                  {latestConsultation.weight && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Peso</span>
                      <span className="font-bold text-gray-800">{latestConsultation.weight} kg</span>
                    </div>
                  )}
                  {bmi && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">IMC</span>
                      <span className={`font-bold ${Number(bmi) < 18.5 ? "text-blue-600" : Number(bmi) < 25 ? "text-green-600" : Number(bmi) < 30 ? "text-yellow-600" : "text-red-600"}`}>
                        {bmi}
                      </span>
                    </div>
                  )}
                  {latestConsultation.bodyFat && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">% Grasa</span>
                      <span className="font-bold text-gray-800">{latestConsultation.bodyFat}%</span>
                    </div>
                  )}
                  {latestConsultation.muscleMass && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Masa muscular</span>
                      <span className="font-bold text-gray-800">{latestConsultation.muscleMass} kg</span>
                    </div>
                  )}
                  {latestConsultation.calTarget && (
                    <div className="flex justify-between items-center border-t pt-2 mt-2">
                      <span className="text-sm text-gray-500">Meta cal.</span>
                      <span className="font-bold text-orange-600">{latestConsultation.calTarget} kcal</span>
                    </div>
                  )}
                  <div className="text-xs text-gray-400 border-t pt-2 mt-1">
                    Consulta #{latestConsultation.consultationNumber} •{" "}
                    {new Date(latestConsultation.date).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 text-center py-3">Sin consultas aún</p>
              )}

              {/* Next appointment */}
              {latestConsultation?.nextAppointment && (
                <div className="mt-2 p-2 bg-orange-50 rounded-lg border border-orange-100">
                  <div className="flex items-center gap-1 text-xs font-medium text-orange-700">
                    <Calendar className="h-3.5 w-3.5" />
                    Próxima cita
                  </div>
                  <p className="text-sm font-semibold text-orange-800 mt-0.5">
                    {new Date(latestConsultation.nextAppointment).toLocaleDateString("es-PE", {
                      weekday: "short", day: "2-digit", month: "long",
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Consultation history — client component for interactivity */}
        <NutritionClientDetail clientId={id} consultations={serialized.consultations} />
      </main>
    </>
  )
}
