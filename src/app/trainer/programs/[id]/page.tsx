import { requireTrainerPage } from "@/lib/coaching/auth"
import { withCoachErrors } from "@/components/coaching/withCoachErrors"
import ProgramEditor from "@/components/coaching/programs/ProgramEditor"

export const dynamic = "force-dynamic"

async function TrainerProgramPage({ params }: PageProps<"/trainer/programs/[id]">) {
  await requireTrainerPage()
  const { id } = await params
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <ProgramEditor id={id} basePath="/trainer" />
    </div>
  )
}

export default withCoachErrors("Rutina", TrainerProgramPage)
