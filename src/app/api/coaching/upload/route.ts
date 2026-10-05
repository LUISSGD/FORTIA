import { NextResponse } from "next/server"
import { requireCoachOrTrainer, jsonError } from "@/lib/coaching/auth"
import { uploadCoachingFile } from "@/lib/coaching/upload"

export async function POST(request: Request) {
  const guard = await requireCoachOrTrainer()
  if ("error" in guard) return guard.error
  const file = (await request.formData()).get("file")
  if (!(file instanceof File)) return jsonError("No se recibió archivo")
  const up = await uploadCoachingFile(file, "coach")
  if ("error" in up) return jsonError(up.error, 500)
  return NextResponse.json(up)
}
