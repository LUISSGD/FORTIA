import { formatYmd } from "@/lib/coaching/dates"
import { programDates, programEndLabel, programEndTone } from "@/lib/coaching/program-dates"
import { cn } from "@/lib/utils"

/** "19 oct – 13 dic 2026 · Termina en 54 días" para el programa activo de un cliente. */
export default function ProgramEndLine({ program, className }: { program: { startDate: Date | null; programEnd: Date | null; weeks: number }; className?: string }) {
  const { start, end, daysLeft } = programDates(program)
  if (!end || daysLeft === null) return <p className={cn("text-xs text-gray-400 mt-1", className)}>Sin fecha de inicio</p>
  return (
    <p className={cn("text-xs mt-1", programEndTone(daysLeft), className)}>
      {start ? `${formatYmd(start)} – ` : ""}{formatYmd(end, true)} · {programEndLabel(daysLeft)}
    </p>
  )
}
