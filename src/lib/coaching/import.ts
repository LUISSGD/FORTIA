import ExcelJS from "exceljs"
import { prisma } from "@/lib/prisma"
import { GOALS } from "./constants"

// Importación masiva desde Excel/CSV (exportaciones de Harbiz u otras plataformas).
// Las columnas se reconocen por nombre, con alias en español e inglés.

export type ImportKind = "clients" | "measurements" | "routines"
export type ImportReport = { created: number; updated: number; skipped: number; errors: { row: number; message: string }[]; notes: string[] }
type Row = Record<string, unknown> & { __row: number }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9%]/g, "")

const ALIASES: Record<string, string[]> = {
  firstName: ["nombre", "nombres", "firstname", "name", "first"],
  lastName: ["apellido", "apellidos", "lastname", "surname", "last"],
  fullName: ["cliente", "nombrecompleto", "fullname", "client", "alumno"],
  email: ["email", "correo", "correoelectronico", "mail", "emailcliente"],
  phone: ["telefono", "celular", "movil", "phone", "mobile", "whatsapp"],
  birthDate: ["fechanacimiento", "fechadenacimiento", "nacimiento", "birthdate", "birthday", "dob", "cumpleanos"],
  sex: ["sexo", "genero", "gender", "sex"],
  height: ["altura", "alturacm", "talla", "estatura", "height", "heightcm"],
  goal: ["objetivo", "meta", "goal", "objective"],
  level: ["nivel", "level", "experiencia"],
  trainingDays: ["diasentreno", "diasdeentreno", "diassemana", "trainingdays", "frecuencia"],
  price: ["precio", "preciomensual", "tarifa", "price", "cuota", "mensualidad"],
  startDate: ["fechainicio", "inicio", "fechaalta", "alta", "startdate", "start", "createdat"],
  notes: ["notas", "observaciones", "comentarios", "notes"],
  date: ["fecha", "date", "fechamedicion", "fecharegistro"],
  weight: ["peso", "pesokg", "weight", "weightkg"],
  bodyFat: ["%grasa", "grasa", "grasacorporal", "porcentajegrasa", "bodyfat", "fat%", "%fat"],
  chest: ["pecho", "torax", "chest"],
  waist: ["cintura", "waist", "abdomen"],
  hips: ["cadera", "hips", "hip", "gluteo"],
  arms: ["brazo", "brazos", "biceps", "arm", "arms"],
  legs: ["pierna", "piernas", "muslo", "thigh", "legs", "leg"],
  program: ["programa", "rutina", "plan", "program", "routine", "workout"],
  day: ["dia", "sesion", "day", "session", "entrenamiento"],
  exercise: ["ejercicio", "exercise", "ejercicios"],
  order: ["orden", "order", "#", "n"],
  sets: ["series", "sets", "set"],
  reps: ["reps", "repeticiones", "repetitions", "rep"],
  rest: ["descanso", "descansos", "rest", "restsec", "descansoseg", "pausa"],
  rir: ["rir", "rpe"],
  tempo: ["tempo", "cadencia"],
  load: ["carga", "peso sugerido", "load", "kg", "pesoejercicio"].map(norm),
  exerciseNotes: ["notasejercicio", "indicaciones", "exercisenotes", "comentario"],
}

function mapHeaders(headers: string[]) {
  const map = new Map<number, string>()
  headers.forEach((h, i) => {
    const n = norm(h ?? "")
    if (!n) return
    for (const [key, aliases] of Object.entries(ALIASES)) {
      if (aliases.map(norm).includes(n) && ![...map.values()].includes(key)) {
        map.set(i, key)
        return
      }
    }
  })
  return map
}

function cellValue(v: unknown): unknown {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[]; hyperlink?: string }
    if (o.richText) return o.richText.map((r) => r.text).join("")
    if (o.text) return o.text
    if ("result" in o) return o.result
    return null
  }
  return v
}

function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/)[0] ?? ""
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ","
  const rows: string[][] = []
  let row: string[] = [], cur = "", q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === delim) { row.push(cur); cur = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(cur); rows.push(row); row = []; cur = ""
    } else cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows.filter((r) => r.some((x) => x.trim()))
}

/** Lee un .xlsx o .csv y devuelve filas con claves normalizadas. */
export async function readRows(file: File): Promise<{ rows: Row[]; recognized: string[]; ignored: string[] }> {
  let matrix: unknown[][]
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    matrix = parseCsv((await file.text()).replace(/^﻿/, ""))
  } else {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer)
    const ws = wb.worksheets[0]
    if (!ws) return { rows: [], recognized: [], ignored: [] }
    matrix = []
    ws.eachRow({ includeEmpty: false }, (r) => {
      const vals = (r.values as unknown[]).slice(1).map(cellValue)
      matrix.push(vals)
    })
  }
  const headerIdx = matrix.findIndex((r) => r.filter((x) => x !== null && String(x).trim()).length >= 2)
  if (headerIdx < 0) return { rows: [], recognized: [], ignored: [] }
  const headers = matrix[headerIdx].map((h) => String(h ?? "").trim())
  const map = mapHeaders(headers)
  const rows = matrix.slice(headerIdx + 1).map((r, i) => {
    const o: Row = { __row: headerIdx + i + 2 }
    map.forEach((key, col) => { o[key] = r[col] ?? null })
    return o
  })
  return {
    rows: rows.filter((r) => Object.keys(r).some((k) => k !== "__row" && r[k] !== null && String(r[k]).trim() !== "")),
    recognized: [...map.values()],
    ignored: headers.filter((_, i) => headers[i] && !map.has(i)),
  }
}

// ── Conversores ─────────────────────────────────────────────────────

const s = (v: unknown) => (v === null || v === undefined ? null : String(v).trim() || null)
function n(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  const x = Number(String(v).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."))
  return Number.isFinite(x) ? x : null
}
function d(v: unknown): Date | null {
  if (!v) return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate(), 12))
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30 + Math.floor(v), 12)) // serial Excel
  const t = String(v).trim()
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12))
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]
    return new Date(Date.UTC(y, +m[2] - 1, +m[1], 12))
  }
  return null
}
function sex(v: unknown) {
  const t = norm(String(v ?? ""))
  if (!t) return null
  return /^(f|fem|mujer|female|woman)/.test(t) ? "F" : /^(m|masc|hombre|varon|male|man)/.test(t) ? "M" : null
}
function level(v: unknown) {
  const t = norm(String(v ?? ""))
  if (/princip|begin|inicial|basic/.test(t)) return "PRINCIPIANTE"
  if (/avanz|advanc|expert/.test(t)) return "AVANZADO"
  if (/interm/.test(t)) return "INTERMEDIO"
  return null
}
function goal(v: unknown) {
  const t = s(v)
  if (!t) return null
  const k = norm(t)
  if (/grasa|adelgaz|perder|fatloss|weightloss|definic/.test(k)) return "Perder grasa"
  if (/hipertrof/.test(k)) return "Hipertrofia"
  if (/musculo|volumen|muscle|masa/.test(k)) return "Ganar músculo"
  if (/recompos/.test(k)) return "Recomposición corporal"
  if (/fuerza|strength/.test(k)) return "Fuerza"
  return GOALS.find((g) => norm(g) === k) ?? t
}

function splitName(row: Row) {
  let first = s(row.firstName)
  let last = s(row.lastName)
  if ((!first || !last) && s(row.fullName)) {
    const parts = s(row.fullName)!.split(/\s+/)
    first = first ?? parts[0]
    last = last ?? (parts.slice(1).join(" ") || "-")
  }
  return { first, last }
}

/** Busca el cliente por email, o por nombre + apellido (sin acentos ni mayúsculas). */
async function findClient(row: Row) {
  const email = s(row.email)?.toLowerCase()
  if (email) {
    const c = await prisma.client.findFirst({ where: { email: { equals: email, mode: "insensitive" } } })
    if (c) return c
    const u = await prisma.user.findUnique({ where: { email }, include: { client: true } })
    if (u?.client) return u.client
  }
  const { first, last } = splitName(row)
  if (!first) return null
  const candidates = await prisma.client.findMany({ where: { firstName: { equals: first, mode: "insensitive" } } })
  const target = norm(`${first}${last ?? ""}`)
  return candidates.find((c) => norm(`${c.firstName}${c.lastName}`) === target) ?? (last ? null : candidates.length === 1 ? candidates[0] : null)
}

const emptyReport = (): ImportReport => ({ created: 0, updated: 0, skipped: 0, errors: [], notes: [] })

// ── Clientes ────────────────────────────────────────────────────────

export async function importClients(rows: Row[], write: boolean): Promise<ImportReport> {
  const r = emptyReport()
  for (const row of rows) {
    const { first, last } = splitName(row)
    if (!first) { r.errors.push({ row: row.__row, message: "Falta el nombre" }); continue }
    const existing = await findClient(row)
    const profileData = {
      goal: goal(row.goal),
      level: level(row.level),
      sex: sex(row.sex),
      heightCm: n(row.height),
      trainingDays: n(row.trainingDays) ? Math.min(7, Math.max(1, Math.round(n(row.trainingDays)!))) : undefined,
      price: n(row.price),
    }
    const clean = Object.fromEntries(Object.entries(profileData).filter(([, v]) => v !== null && v !== undefined))
    if (!write) {
      existing ? r.updated++ : r.created++
      continue
    }
    const client = existing
      ? await prisma.client.update({
          where: { id: existing.id },
          data: {
            email: existing.email ?? s(row.email)?.toLowerCase() ?? null,
            phone: existing.phone ?? s(row.phone),
            birthDate: existing.birthDate ?? d(row.birthDate),
          },
        })
      : await prisma.client.create({
          data: {
            firstName: first,
            lastName: last ?? "-",
            email: s(row.email)?.toLowerCase() ?? null,
            phone: s(row.phone),
            birthDate: d(row.birthDate),
            notes: s(row.notes) ?? "Importado de Harbiz",
          },
        })
    const start = d(row.startDate)
    const profile = await prisma.coachingProfile.findUnique({ where: { clientId: client.id } })
    if (profile) {
      await prisma.coachingProfile.update({ where: { clientId: client.id }, data: { ...clean, ...(profile.status === "ENDED" ? { status: "ACTIVE" } : {}) } })
    } else {
      await prisma.coachingProfile.create({ data: { clientId: client.id, ...clean, ...(start ? { startDate: start } : {}), coachNotes: s(row.notes) } })
    }
    existing ? r.updated++ : r.created++
  }
  return r
}

// ── Medidas ─────────────────────────────────────────────────────────

export async function importMeasurements(rows: Row[], write: boolean): Promise<ImportReport> {
  const r = emptyReport()
  const cache = new Map<string, string | null>()
  for (const row of rows) {
    const key = `${s(row.email) ?? ""}|${s(row.firstName) ?? ""}|${s(row.lastName) ?? ""}|${s(row.fullName) ?? ""}`
    if (!cache.has(key)) cache.set(key, (await findClient(row))?.id ?? null)
    const clientId = cache.get(key)
    if (!clientId) { r.errors.push({ row: row.__row, message: "Cliente no encontrado (importa primero los clientes o revisa email/nombre)" }); continue }
    const date = d(row.date)
    if (!date) { r.errors.push({ row: row.__row, message: "Fecha inválida" }); continue }
    const data = { weight: n(row.weight), bodyFat: n(row.bodyFat), chest: n(row.chest), waist: n(row.waist), hips: n(row.hips), arms: n(row.arms), legs: n(row.legs), height: n(row.height) }
    if (Object.values(data).every((v) => v === null)) { r.skipped++; continue }
    const existing = await prisma.physicalRecord.findFirst({ where: { clientId, date } })
    if (write) {
      const values = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null))
      if (existing) await prisma.physicalRecord.update({ where: { id: existing.id }, data: values })
      else await prisma.physicalRecord.create({ data: { clientId, date, ...data, notes: "Importado de Harbiz" } })
    }
    existing ? r.updated++ : r.created++
  }
  return r
}

// ── Rutinas ─────────────────────────────────────────────────────────

/** Una fila por ejercicio. Filas con el mismo cliente + programa se agrupan; "Día" define los días. Sin cliente → plantilla. */
export async function importRoutines(rows: Row[], write: boolean): Promise<ImportReport> {
  const r = emptyReport()
  const exercises = await prisma.exercise.findMany({ select: { id: true, name: true } })
  const exByName = new Map(exercises.map((e) => [norm(e.name), e.id]))
  const newExercises = new Set<string>()

  type Group = { clientId: string | null; clientLabel: string; program: string; days: Map<string, { name: string; items: { exercise: string; order: number; row: Row }[] }> }
  const groups = new Map<string, Group>()
  const clientCache = new Map<string, string | null>()

  for (const row of rows) {
    const exercise = s(row.exercise)
    if (!exercise) { r.skipped++; continue }
    const hasClient = !!(s(row.email) || s(row.firstName) || s(row.fullName))
    let clientId: string | null = null
    if (hasClient) {
      const key = `${s(row.email) ?? ""}|${s(row.firstName) ?? ""}|${s(row.lastName) ?? ""}|${s(row.fullName) ?? ""}`
      if (!clientCache.has(key)) clientCache.set(key, (await findClient(row))?.id ?? null)
      clientId = clientCache.get(key) ?? null
      if (!clientId) { r.errors.push({ row: row.__row, message: "Cliente no encontrado" }); continue }
    }
    const program = s(row.program) ?? "Rutina importada"
    const gKey = `${clientId ?? "TEMPLATE"}|${program}`
    if (!groups.has(gKey)) groups.set(gKey, { clientId, clientLabel: s(row.email) ?? s(row.fullName) ?? `${s(row.firstName) ?? ""} ${s(row.lastName) ?? ""}`.trim(), program, days: new Map() })
    const g = groups.get(gKey)!
    const dayName = s(row.day) ?? "Día 1"
    if (!g.days.has(dayName)) g.days.set(dayName, { name: dayName, items: [] })
    const day = g.days.get(dayName)!
    day.items.push({ exercise, order: n(row.order) ?? day.items.length + 1, row })
    if (!exByName.has(norm(exercise))) newExercises.add(exercise)
  }

  if (newExercises.size) r.notes.push(`Se crearán ${newExercises.size} ejercicio(s) nuevos en tu biblioteca: ${[...newExercises].slice(0, 12).join(", ")}${newExercises.size > 12 ? "…" : ""}. Revisa su grupo muscular y agrega video.`)

  for (const g of groups.values()) {
    const existing = await prisma.program.findFirst({ where: { name: g.program, clientId: g.clientId, isTemplate: !g.clientId } })
    if (!write) { existing ? r.updated++ : r.created++; continue }

    for (const name of newExercises) {
      if (!exByName.has(norm(name))) {
        const e = await prisma.exercise.upsert({ where: { name }, create: { name, muscleGroup: "FULLBODY", isCustom: true }, update: { isActive: true } })
        exByName.set(norm(name), e.id)
      }
    }
    await prisma.$transaction(async (tx) => {
      let programId = existing?.id
      if (existing) {
        await tx.programDay.deleteMany({ where: { programId: existing.id } })
      } else {
        if (g.clientId) await tx.program.updateMany({ where: { clientId: g.clientId, isActive: true }, data: { isActive: false } })
        programId = (await tx.program.create({ data: { name: g.program, clientId: g.clientId, isTemplate: !g.clientId, startDate: g.clientId ? new Date() : null } })).id
      }
      let di = 0
      for (const day of g.days.values()) {
        const created = await tx.programDay.create({ data: { programId: programId!, name: day.name, order: di++ } })
        const items = [...day.items].sort((a, b) => a.order - b.order)
        await tx.programExercise.createMany({
          data: items.map((it, i) => ({
            dayId: created.id,
            exerciseId: exByName.get(norm(it.exercise))!,
            order: i,
            sets: Math.max(1, Math.round(n(it.row.sets) ?? 3)),
            reps: s(it.row.reps) ?? "8-10",
            restSec: Math.round(n(it.row.rest) ?? 90),
            rir: s(it.row.rir),
            tempo: s(it.row.tempo),
            load: s(it.row.load),
            notes: s(it.row.exerciseNotes),
          })),
        })
      }
    }, { timeout: 30_000, maxWait: 10_000 })
    existing ? r.updated++ : r.created++
  }
  return r
}

// ── Plantillas descargables ─────────────────────────────────────────

export const TEMPLATES: Record<ImportKind, { headers: string[]; example: (string | number)[][] }> = {
  clients: {
    headers: ["Nombre", "Apellido", "Email", "Teléfono", "Fecha nacimiento", "Sexo", "Altura (cm)", "Objetivo", "Nivel", "Días entreno", "Precio mensual", "Fecha inicio", "Notas"],
    example: [["Carlos", "Pérez", "carlos@correo.com", "999888777", "12/05/1994", "M", 175, "Perder grasa", "Intermedio", 4, 600, "01/03/2026", ""]],
  },
  measurements: {
    headers: ["Email", "Nombre", "Apellido", "Fecha", "Peso", "% grasa", "Pecho", "Cintura", "Cadera", "Brazo", "Pierna"],
    example: [["carlos@correo.com", "Carlos", "Pérez", "01/09/2026", 82.4, 18, 102, 89, 98, 35, 56], ["carlos@correo.com", "Carlos", "Pérez", "01/10/2026", 79.8, 16.5, 104, 84, 96, 36, 56]],
  },
  routines: {
    headers: ["Email", "Nombre", "Apellido", "Programa", "Día", "Orden", "Ejercicio", "Series", "Reps", "Descanso", "RIR", "Tempo", "Carga", "Notas ejercicio"],
    example: [
      ["carlos@correo.com", "Carlos", "Pérez", "Hipertrofia 4 días", "Lunes — PUSH", 1, "Press banca", 4, "8-10", 120, 2, "3-1-1", "80 kg", ""],
      ["carlos@correo.com", "Carlos", "Pérez", "Hipertrofia 4 días", "Lunes — PUSH", 2, "Press inclinado con mancuernas", 3, "10-12", 90, 2, "", "", ""],
      ["", "", "", "Plantilla Full Body", "Día 1", 1, "Sentadilla con barra", 4, "6-8", 150, 2, "", "", "Deja email y nombre vacíos para crear una plantilla"],
    ],
  },
}

export async function templateXlsx(kind: ImportKind) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet({ clients: "Clientes", measurements: "Medidas", routines: "Rutinas" }[kind])
  const t = TEMPLATES[kind]
  ws.addRow(t.headers).font = { bold: true }
  t.example.forEach((r) => ws.addRow(r))
  ws.columns.forEach((c) => { c.width = 18 })
  return Buffer.from(await wb.xlsx.writeBuffer())
}
