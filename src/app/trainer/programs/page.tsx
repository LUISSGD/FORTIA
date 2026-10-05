import { requireTrainerPage } from "@/lib/coaching/auth"
import { withCoachErrors } from "@/components/coaching/withCoachErrors"
import ProgramsLibrary from "@/components/coaching/programs/ProgramsLibrary"

export const dynamic = "force-dynamic"

async function TrainerProgramsPage() {
  await requireTrainerPage()
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <ProgramsLibrary basePath="/trainer" />
    </div>
  )
}

export default withCoachErrors("Rutinas", TrainerProgramsPage)
