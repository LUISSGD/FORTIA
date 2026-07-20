import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { recordId } = await params
  await prisma.physicalRecord.delete({ where: { id: recordId } })
  return NextResponse.json({ ok: true })
}
