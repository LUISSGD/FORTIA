import TrainerMonth from "@/components/coaching/TrainerMonth"

export const dynamic = "force-dynamic"

export default async function CoachClassesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  return <TrainerMonth basePath="/coaching" month={typeof sp.month === "string" ? sp.month : undefined} trainer={typeof sp.t === "string" ? sp.t : undefined} />
}
