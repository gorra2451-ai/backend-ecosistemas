// Con señal débil (p. ej. manejando) el navegador dice "en línea" pero la petición se queda colgada para siempre:
// el botón se quedaba en "Enviando…" y el reporte nunca pasaba a la cola. Aquí se corta a los `ms`
// y el error cae como `sin_red` (api.js), así el reporte se guarda y se reenvía solo.
// Storage (fotos) no se corta: una foto con poca señal sí puede tardar más.
export const LIMITE_RED_MS = 15000

export function fetchConLimite(base = (...a) => fetch(...a), ms = LIMITE_RED_MS) {
  return (url, opciones = {}) => {
    if (String(url).includes('/storage/v1/')) return base(url, opciones)
    const ctrl = new AbortController()
    const err = new Error('network timeout: sin respuesta del servidor')
    err.name = 'TimeoutError'
    const t = setTimeout(() => ctrl.abort(err), ms)
    opciones.signal?.addEventListener?.('abort', () => ctrl.abort(opciones.signal.reason))
    return base(url, { ...opciones, signal: ctrl.signal }).finally(() => clearTimeout(t))
  }
}
