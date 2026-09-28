import { NextResponse } from "next/server"
import { requireCoach, jsonError } from "@/lib/coaching/auth"
import { importClients, importMeasurements, importRoutines, readRows, templateXlsx, type ImportKind } from "@/lib/coaching/import"

type Params = { params: Promise<{ kind: string }> }
const KINDS: ImportKind[] = ["clients", "measurements", "routines"]
const MAX_BYTES = 10 * 1024 * 1024

/** Descarga la plantilla .xlsx de ejemplo. */
export async function GET(_request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { kind } = await params
  if (!KINDS.includes(kind as ImportKind)) return jsonError("Tipo inválido", 404)
  const buf = await templateXlsx(kind as ImportKind)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="fortia-plantilla-${kind}.xlsx"`,
    },
  })
}

/** Multipart: file (.xlsx/.csv), dryRun ("1" = solo vista previa). */
export async function POST(request: Request, { params }: Params) {
  const guard = await requireCoach()
  if ("error" in guard) return guard.error
  const { kind } = await params
  if (!KINDS.includes(kind as ImportKind)) return jsonError("Tipo inválido", 404)
  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File) || !file.size) return jsonError("Sube un archivo .xlsx o .csv")
  if (file.size > MAX_BYTES) return jsonError("El archivo supera 10 MB")
  if (!/\.(xlsx|csv)$/i.test(file.name)) return jsonError("Formato no soportado. Usa .xlsx o .csv (si tienes .xls, guárdalo como .xlsx)")
  const write = form.get("dryRun") !== "1"

  let parsed
  try {
    parsed = await readRows(file)
  } catch (e) {
    console.error(e)
    return jsonError("No se pudo leer el archivo")
  }
  if (!parsed.rows.length) return jsonError("El archivo no tiene filas con datos")

  const run = { clients: importClients, measurements: importMeasurements, routines: importRoutines }[kind as ImportKind]
  const report = await run(parsed.rows, write)
  return NextResponse.json({ ...report, rows: parsed.rows.length, recognized: parsed.recognized, ignored: parsed.ignored, dryRun: !write })
}
