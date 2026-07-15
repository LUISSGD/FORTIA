"use client"

import { useState } from "react"
import { Dumbbell } from "lucide-react"
import SlotDetailModal from "./SlotDetailModal"
import { DAYS_OF_WEEK } from "@/lib/utils"

// 06:00 to 22:00, 16 hours total
const START_HOUR = 6
const END_HOUR = 22
const TOTAL_HOURS = END_HOUR - START_HOUR
const PX_PER_HOUR = 60

const HOUR_LABELS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
  const h = START_HOUR + i
  return `${String(h).padStart(2, "0")}:00`
})

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function computeLayout(daySlots: Slot[]): Map<string, { col: number; totalCols: number }> {
  const sorted = [...daySlots].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
  const layout = new Map<string, { col: number; totalCols: number }>()
  const groups: Slot[][] = []

  for (const slot of sorted) {
    const s = timeToMinutes(slot.startTime)
    const e = timeToMinutes(slot.endTime)
    let placed = false
    for (const group of groups) {
      if (group.some(g => s < timeToMinutes(g.endTime) && e > timeToMinutes(g.startTime))) {
        group.push(slot)
        placed = true
        break
      }
    }
    if (!placed) groups.push([slot])
  }

  for (const group of groups) {
    group.forEach((slot, i) => layout.set(slot.id, { col: i, totalCols: group.length }))
  }
  return layout
}

interface Client {
  id: string
  firstName: string
  lastName: string
  phone?: string | null
}

interface Enrollment {
  id: string
  clientId: string
  client: Client
}

export interface Slot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  instructor?: string | null
  class: { name: string; color: string; maxCapacity: number }
  enrollments: Enrollment[]
  isPT?: boolean
  planId?: string
  clientId?: string
}

export default function WeeklyGrid({ slots }: { slots: Slot[] }) {
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)

  const gridHeight = TOTAL_HOURS * PX_PER_HOUR

  function getTop(startTime: string) {
    const mins = timeToMinutes(startTime) - START_HOUR * 60
    return (mins / 60) * PX_PER_HOUR
  }

  function getHeight(startTime: string, endTime: string) {
    const startMins = timeToMinutes(startTime)
    const endMins = timeToMinutes(endTime)
    const durationHours = (endMins - startMins) / 60
    return Math.max(durationHours * PX_PER_HOUR, PX_PER_HOUR * 0.5)
  }

  return (
    <>
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50">
            <div className="p-2 text-xs text-gray-400 font-medium">Hora</div>
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="p-2 text-center text-xs font-semibold text-gray-700 border-l border-gray-100">
                {day}
              </div>
            ))}
          </div>

          {/* Grid body */}
          <div className="grid grid-cols-8" style={{ height: gridHeight }}>
            {/* Hour labels column */}
            <div className="relative border-r border-gray-100">
              {HOUR_LABELS.map((label, i) => (
                <div
                  key={label}
                  className="absolute left-0 right-0 border-t border-gray-100 flex items-start pl-2 pt-0.5"
                  style={{ top: i * PX_PER_HOUR, height: PX_PER_HOUR }}
                >
                  <span className="text-xs text-gray-400">{label}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {DAYS_OF_WEEK.map((_, dayIndex) => {
              const daySlots = slots.filter((s) => s.dayOfWeek === dayIndex)
              const layout = computeLayout(daySlots)
              return (
                <div key={dayIndex} className="relative border-l border-gray-100" style={{ height: gridHeight }}>
                  {/* Hour grid lines */}
                  {HOUR_LABELS.map((_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-gray-100"
                      style={{ top: i * PX_PER_HOUR }}
                    />
                  ))}

                  {/* Slots */}
                  {daySlots.map((slot) => {
                    const top = getTop(slot.startTime)
                    const height = getHeight(slot.startTime, slot.endTime)
                    const { col, totalCols } = layout.get(slot.id) ?? { col: 0, totalCols: 1 }
                    const leftPct = (col / totalCols) * 100
                    const widthPct = (1 / totalCols) * 100
                    return (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlot(slot)}
                        className="absolute rounded-md px-2 py-1 text-left hover:opacity-90 transition-opacity overflow-hidden z-10"
                        style={{
                          top: top + 1,
                          height: height - 2,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          backgroundColor: slot.class.color + "25",
                          borderLeft: `3px solid ${slot.class.color}`,
                        }}
                      >
                        <p className="text-xs font-semibold leading-tight truncate flex items-center gap-0.5" style={{ color: slot.class.color }}>
                          {slot.isPT && <Dumbbell className="inline h-2.5 w-2.5 flex-shrink-0" />}
                          <span className="truncate">{slot.class.name}</span>
                        </p>
                        <p className="text-xs text-gray-500 leading-tight">
                          {slot.startTime}–{slot.endTime}
                        </p>
                        {slot.instructor && (
                          <p className="text-xs text-gray-400 leading-tight truncate">{slot.instructor}</p>
                        )}
                        {!slot.isPT && (
                          <p className="text-xs text-gray-400 leading-tight">
                            {slot.enrollments.length}/{slot.class.maxCapacity}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <SlotDetailModal
        slot={selectedSlot}
        open={!!selectedSlot}
        onClose={() => setSelectedSlot(null)}
      />
    </>
  )
}
