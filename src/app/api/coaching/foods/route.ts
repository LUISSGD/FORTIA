import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCoach, jsonError } from "@/lib/coaching/auth"
import { foodData } from "./shared"

export async function GET(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const q = new URL(request.url).searchParams.get("q")?.trim()
  const foods = await prisma.food.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: [{ category: "asc" }, { name: "asc" }],
  })
  return NextResponse.json(foods)
}

export async function POST(request: Request) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const data = foodData(await request.json())
  if (!data.name) return jsonError("Nombre obligatorio")
  if (await prisma.food.findUnique({ where: { name: data.name } })) return jsonError("Ya existe un alimento con ese nombre")
  return NextResponse.json(await prisma.food.create({ data: { ...data, isCustom: true } }), { status: 201 })
}
