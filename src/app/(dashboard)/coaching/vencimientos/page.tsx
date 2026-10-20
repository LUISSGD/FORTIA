import ExpiryList from "@/components/coaching/ExpiryList"

export const dynamic = "force-dynamic"

export default async function VencimientosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  return <ExpiryList basePath="/coaching" showStandby={sp.standby === "1"} />
}
