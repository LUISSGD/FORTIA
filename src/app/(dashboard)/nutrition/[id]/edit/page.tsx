import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import NutritionEditForm from "./NutritionEditForm"

export const dynamic = "force-dynamic"

type PageProps = { params: Promise<{ id: string }> }

export default async function NutritionEditPage({ params }: PageProps) {
  const { id } = await params
  const client = await prisma.nutritionClient.findUnique({ where: { id } })
  if (!client) notFound()

  const serialized = {
    ...client,
    clientId: client.clientId ?? null,
    birthDate: client.birthDate?.toISOString().split("T")[0] ?? "",
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  }

  return <NutritionEditForm client={serialized} />
}
