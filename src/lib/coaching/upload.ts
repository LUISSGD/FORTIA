import { supabase } from "@/lib/supabase"

const BUCKET = process.env.SUPABASE_COACHING_BUCKET ?? "coaching"
const MAX_BYTES = 25 * 1024 * 1024

export function attachmentType(mime: string) {
  if (mime.startsWith("image/")) return "IMAGE"
  if (mime.startsWith("video/")) return "VIDEO"
  if (mime.startsWith("audio/")) return "AUDIO"
  return "FILE"
}

/** Sube un archivo a Supabase Storage (bucket público "coaching"). Crea el bucket si no existe. */
export async function uploadCoachingFile(file: File, folder: string): Promise<{ url: string; type: string } | { error: string }> {
  if (file.size > MAX_BYTES) return { error: "El archivo supera 25 MB" }
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`

  let { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error && /not.?found/i.test(error.message)) {
    await supabase.storage.createBucket(BUCKET, { public: true })
    ;({ error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false }))
  }
  if (error) {
    console.error("Supabase upload error:", error)
    return { error: "Error al subir el archivo" }
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, type: attachmentType(file.type) }
}
