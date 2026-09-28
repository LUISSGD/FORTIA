/**
 * Envuelve una página server del panel de coaching: si falla la carga de datos, muestra el
 * mensaje real del error (solo lo ve el entrenador) en lugar de la pantalla genérica de Next.js,
 * que en producción oculta el detalle.
 */
export function withCoachErrors<P>(label: string, Page: (props: P) => Promise<React.ReactElement>) {
  return async function Wrapped(props: P) {
    try {
      return await Page(props)
    } catch (e) {
      // redirect()/notFound() de Next.js deben seguir propagándose
      if (e && typeof e === "object" && "digest" in e && /^NEXT_/.test(String((e as { digest: unknown }).digest))) throw e
      const err = e as Error & { code?: string }
      console.error(`[coaching:${label}]`, e)
      return (
        <div className="max-w-2xl mx-auto mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm space-y-2">
          <p className="font-semibold text-red-700">No se pudo cargar “{label}”.</p>
          <p className="text-red-700 break-words font-mono text-xs">{err.code ? `${err.code}: ` : ""}{String(err.message ?? e).slice(0, 800)}</p>
          <p className="text-xs text-red-500">Envía una captura de este mensaje para corregirlo.</p>
        </div>
      )
    }
  }
}
