"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
import {
  getTrainingPrice,
  getAvailableModalidades,
  getAvailableTarifas,
  getAvailableNumPacks,
  ENTRENADOR_LABELS,
  MODALIDAD_LABELS,
  TARIFA_LABELS,
} from "@/lib/training-pricing"
import type { Entrenador, Modalidad, Tarifa, NumPacks, ClasesPerPack } from "@/lib/training-pricing"

const ENTRENADORES: Entrenador[] = ["HEAD_COACH", "TEAM_FORTIA"]
const CLASES_OPTIONS: ClasesPerPack[] = [4, 8, 12, 16]
const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

interface ScheduleDay {
  dayOfWeek: number
  startTime: string
  endTime: string
}

interface Props {
  clientId: string
  onAssigned: () => void
}

export default function AssignTrainingPlanDialog({ clientId, onAssigned }: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [entrenador, setEntrenador] = useState<Entrenador | "">("")
  const [modalidad, setModalidad] = useState<Modalidad | "">("")
  const [tarifa, setTarifa] = useState<Tarifa | "">("")
  const [clasesPerPack, setClasesPerPack] = useState<ClasesPerPack | 0>(0)
  const [numPacks, setNumPacks] = useState<NumPacks | 0>(0)
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0])
  const [notes, setNotes] = useState("")

  // Schedule state
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [schedStartTime, setSchedStartTime] = useState("07:00")
  const [schedEndTime, setSchedEndTime] = useState("08:00")
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([])

  const modalidades = entrenador ? getAvailableModalidades(entrenador as Entrenador) : []
  const tarifas = entrenador && modalidad ? getAvailableTarifas(entrenador as Entrenador, modalidad as Modalidad) : []
  const numPacksOptions = entrenador && modalidad && tarifa
    ? getAvailableNumPacks(entrenador as Entrenador, modalidad as Modalidad, tarifa as Tarifa)
    : []
  const hasMultipleTarifas = tarifas.length > 1

  const price = entrenador && modalidad && tarifa && clasesPerPack && numPacks
    ? getTrainingPrice(entrenador as Entrenador, modalidad as Modalidad, tarifa as Tarifa, numPacks as NumPacks, clasesPerPack as ClasesPerPack)
    : null

  useEffect(() => { setModalidad(""); setTarifa(""); setClasesPerPack(0); setNumPacks(0) }, [entrenador])
  useEffect(() => {
    setNumPacks(0)
    if (modalidad) {
      const available = getAvailableTarifas(entrenador as Entrenador, modalidad as Modalidad)
      if (available.length === 1) setTarifa(available[0])
      else setTarifa("")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalidad])
  useEffect(() => { setNumPacks(0) }, [tarifa])

  function toggleDay(d: number) {
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function addScheduleDays() {
    if (selectedDays.length === 0) return
    const newDays: ScheduleDay[] = selectedDays.map(d => ({ dayOfWeek: d, startTime: schedStartTime, endTime: schedEndTime }))
    setScheduleDays(prev => {
      const existingDays = new Set(prev.map(x => x.dayOfWeek))
      return [...prev, ...newDays.filter(d => !existingDays.has(d.dayOfWeek))]
    })
    setSelectedDays([])
  }

  function removeScheduleDay(day: number) {
    setScheduleDays(prev => prev.filter(d => d.dayOfWeek !== day))
  }

  async function handleSave() {
    if (!entrenador || !modalidad || !tarifa || !clasesPerPack || !numPacks) {
      toast.error("Completa todos los campos")
      return
    }
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/training-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoEntrenador: entrenador, modalidad, tarifa, numPacks, clasesPerPack,
        startDate, notes,
        scheduleDays: scheduleDays.length > 0 ? scheduleDays : undefined,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success("Plan asignado correctamente")
      setOpen(false)
      onAssigned()
    } else {
      const err = await res.json()
      toast.error(err.error ?? "Error al asignar plan")
    }
  }

  function handleOpen() {
    setEntrenador(""); setModalidad(""); setTarifa(""); setClasesPerPack(0); setNumPacks(0)
    setStartDate(new Date().toISOString().split("T")[0])
    setNotes(""); setSelectedDays([]); setScheduleDays([])
    setSchedStartTime("07:00"); setSchedEndTime("08:00")
    setOpen(true)
  }

  return (
    <>
      <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={handleOpen}>
        <Plus className="h-3.5 w-3.5 mr-1" />Asignar plan
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asignar entrenamiento personalizado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de entrenador</Label>
              <Select value={entrenador} onValueChange={v => setEntrenador(v as Entrenador)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {ENTRENADORES.map(e => (
                    <SelectItem key={e} value={e}>{ENTRENADOR_LABELS[e]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {entrenador && (
              <div>
                <Label>Modalidad</Label>
                <Select value={modalidad} onValueChange={v => setModalidad(v as Modalidad)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {modalidades.map(m => (
                      <SelectItem key={m} value={m}>{MODALIDAD_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {modalidad && hasMultipleTarifas && (
              <div>
                <Label>Tarifa</Label>
                <Select value={tarifa} onValueChange={v => setTarifa(v as Tarifa)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {tarifas.map(t => (
                      <SelectItem key={t} value={t}>{TARIFA_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tarifa && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Clases por pack</Label>
                  <Select
                    value={clasesPerPack ? String(clasesPerPack) : ""}
                    onValueChange={v => setClasesPerPack(Number(v) as ClasesPerPack)}
                  >
                    <SelectTrigger><SelectValue placeholder="4 / 8 / 12 / 16" /></SelectTrigger>
                    <SelectContent>
                      {CLASES_OPTIONS.map(c => (
                        <SelectItem key={c} value={String(c)}>{c} clases / 4 sem.</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Número de packs</Label>
                  <Select
                    value={numPacks ? String(numPacks) : ""}
                    onValueChange={v => setNumPacks(Number(v) as NumPacks)}
                    disabled={!tarifa}
                  >
                    <SelectTrigger><SelectValue placeholder="01 / 03 / 06" /></SelectTrigger>
                    <SelectContent>
                      {numPacksOptions.map(n => (
                        <SelectItem key={n} value={String(n)}>{String(n).padStart(2, "0")} pack{n > 1 ? "s" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {price !== null && (
              <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                <p className="text-xs text-gray-500">Precio total</p>
                <p className="text-2xl font-bold text-orange-600">S/ {price.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-400">{numPacks} pack{Number(numPacks) > 1 ? "s" : ""} × {clasesPerPack} clases = {Number(numPacks) * Number(clasesPerPack)} clases totales</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha de inicio</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label>Notas (opcional)</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observación..." />
              </div>
            </div>

            {/* Schedule section */}
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-600">Horario semanal (opcional)</p>
              <p className="text-xs text-gray-400">Selecciona los días con el mismo horario y haz clic en Agregar. Repite para horarios distintos.</p>

              {scheduleDays.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {scheduleDays.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map(d => (
                    <div key={d.dayOfWeek} className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded px-2 py-0.5 text-xs">
                      <span className="font-medium text-orange-700">{DAY_LABELS[d.dayOfWeek]}</span>
                      <span className="text-gray-500">{d.startTime}–{d.endTime}</span>
                      <button onClick={() => removeScheduleDay(d.dayOfWeek)} className="text-red-400 hover:text-red-600 ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    disabled={scheduleDays.some(d => d.dayOfWeek === i)}
                    className={`text-xs px-2 py-1 rounded border font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      selectedDays.includes(i)
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Inicio</Label>
                  <Input type="time" value={schedStartTime} onChange={e => setSchedStartTime(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Fin</Label>
                  <Input type="time" value={schedEndTime} onChange={e => setSchedEndTime(e.target.value)} className="h-8 text-xs" />
                </div>
                <Button size="sm" type="button" className="h-8 bg-orange-500 hover:bg-orange-600 text-xs" onClick={addScheduleDays} disabled={selectedDays.length === 0}>
                  Agregar
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-orange-500 hover:bg-orange-600"
                onClick={handleSave}
                disabled={saving || !entrenador || !modalidad || !tarifa || !clasesPerPack || !numPacks}
              >
                {saving ? "Asignando..." : "Asignar plan"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
