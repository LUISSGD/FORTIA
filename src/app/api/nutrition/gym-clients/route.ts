import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  const id = req.nextUrl.searchParams.get("id")?.trim() ?? ""

  const clients = await prisma.client.findMany({
    where: id
      ? { id }
      : q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { dni: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      dni: true,
      birthDate: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 100,
  })

  return NextResponse.json(clients)
}
