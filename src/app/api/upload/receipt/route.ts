import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 })

  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `receipts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) {
    console.error("Supabase upload error:", error)
    return NextResponse.json({ error: "Error al subir el archivo" }, { status: 500 })
  }

  const { data } = supabase.storage.from("receipts").getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
