/**
 * fetch con límite de tiempo y errores legibles para la app del cliente.
 * Nunca deja la UI "colgada": o devuelve los datos, o lanza un Error con un mensaje claro.
 */
export async function request<T = Record<string, unknown>>(url: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal })
    const text = await res.text()
    let data: unknown = {}
    try { data = text ? JSON.parse(text) : {} } catch { data = {} }
    if (!res.ok) {
      const msg = (data as { error?: string }).error
      throw new Error(msg ?? (res.status >= 500 ? `El servidor tuvo un problema (${res.status}). Intenta de nuevo.` : `Error ${res.status}`))
    }
    return data as T
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("La conexión está tardando demasiado. Revisa tu internet e intenta de nuevo.")
    if (e instanceof TypeError) throw new Error("Sin conexión. Revisa tu internet e intenta de nuevo.")
    throw e
  } finally {
    clearTimeout(timer)
  }
}
