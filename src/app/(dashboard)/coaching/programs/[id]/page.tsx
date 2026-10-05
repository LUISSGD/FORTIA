import ProgramEditor from "@/components/coaching/programs/ProgramEditor"

export const dynamic = "force-dynamic"

export default async function ProgramPage({ params }: PageProps<"/coaching/programs/[id]">) {
  const { id } = await params
  return <ProgramEditor id={id} basePath="/coaching" />
}
