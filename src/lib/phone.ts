// Celulares: se guardan "987654321" (Perú) o "+54911..." (otro país), listos para WhatsApp.

/** Celular limpio y válido para guardar, o null si no lo es. */
export function normalizePhone(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim()
  const digits = raw.replace(/\D/g, "")
  if (raw.startsWith("+") && !digits.startsWith("51")) return /^\d{8,15}$/.test(digits) ? `+${digits}` : null
  const local = digits.length === 11 && digits.startsWith("51") ? digits.slice(2) : digits
  return /^9\d{8}$/.test(local) ? local : null
}

export const hasValidPhone = (value: string | null | undefined) => normalizePhone(value) !== null
