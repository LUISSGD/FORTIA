import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireClient } from "@/lib/coaching/auth"

export async function GET(request: Request) {
  const guard = await requireClient()
  if ("error" in guard) return guard.error
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) return NextResponse.json([])
  const foods = await prisma.food.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: 20,
  })
  return NextResponse.json(foods)
}
