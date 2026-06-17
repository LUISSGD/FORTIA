"use client"

import { useState } from "react"
import SlotDetailModal from "./SlotDetailModal"
import { DAYS_OF_WEEK } from "@/lib/utils"

const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => {
  const hour = i + 6
  return `${String(hour).padStart(2, "0")}:00`
})

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

interface Slot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  instructor?: string | null
  class: { name: string; color: string; maxCapacity: number }
  enrollments: Enrollment[]
}

export default function WeeklyGrid({ slots }: { slots: Slot[] }) {
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)

  function getSlot(day: number, time: string) {
    return slots.find((s) => s.dayOfWeek === day && s.startTime === time)
  }

  return (
    <>
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="grid grid-cols-8 border-b border-gray-200">
            <div className="p-2 text-xs text-gray-400 font-medium">Hora</div>
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="p-2 text-center text-xs font-semibold text-gray-700 border-l border-gray-100">
                {day}
              </div>
            ))}
          </div>

          {/* Time rows */}
          {TIME_SLOTS.map((time) => (
            <div key={time} className="grid grid-cols-8 border-b border-gray-100 min-h-[52px]">
              <div className="p-2 text-xs text-gray-400 flex items-start pt-2">{time}</div>
              {DAYS_OF_WEEK.map((_, dayIndex) => {
                const slot = getSlot(dayIndex, time)
                return (
                  <div
                    key={dayIndex}
                    className="border-l border-gray-100 p-1"
                  >
                    {slot && (
                      <button
                        onClick={() => setSelectedSlot(slot)}
                        className="w-full rounded-md px-2 py-1.5 text-left hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: slot.class.color + "20", borderLeft: `3px solid ${slot.class.color}` }}
                      >
                        <p className="text-xs font-semibold" style={{ color: slot.class.color }}>
                          {slot.class.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {slot.enrollments.length}/{slot.class.maxCapacity}
                          {slot.instructor && ` · ${slot.instructor.split(" ")[0]}`}
                        </p>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
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
