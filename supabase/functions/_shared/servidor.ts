export type Entorno = (nombre: string) => string | undefined
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8' },
})
export function contextoServidor(env: Entorno) {
  let key: string | undefined
  try {
    const claves = JSON.parse(env('SUPABASE_SECRET_KEYS') ?? '{}')
    if (typeof claves?.default === 'string' && claves.default) key = claves.default
  } catch { /* Compatibilidad con instalaciones que solo tienen service_role. */ }
  key ||= env('SUPABASE_SERVICE_ROLE_KEY')
  const url = env('SUPABASE_URL')?.replace(/\/$/, '')
  if (!key || !url) return null
  const headers: Record<string, string> = { apikey: key, 'content-type': 'application/json' }
  // La Data API necesita también el bearer cuando la credencial es un JWT legacy.
  if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`
  return { key, url, headers }
}
export function igualConstante(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b)
  let distinto = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) distinto |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return distinto === 0
}
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function parametroEntero(url: string, headers: Record<string, string>,
  clave: string, maximo: number, solicitar: typeof fetch): Promise<number> {
  const respuesta = await solicitar(
    `${url}/rest/v1/parametros?clave=eq.${encodeURIComponent(clave)}&select=valor`,
    { headers, signal: AbortSignal.timeout(5000) })
  if (!respuesta.ok) throw new Error('parametros_no_disponibles')
  const filas: unknown = await respuesta.json()
  if (!Array.isArray(filas) || filas.length !== 1) throw new Error('parametros_invalidos')
  const valor: unknown = filas[0]?.valor
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 1 || valor > maximo) {
    throw new Error('parametros_invalidos')
  }
  return valor
}
