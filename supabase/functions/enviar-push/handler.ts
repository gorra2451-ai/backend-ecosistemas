import webpush from 'npm:web-push@3.6.7'
import { contextoServidor, igualConstante, json, uuid, type Entorno } from '../_shared/servidor.ts'
type Suscripcion = { endpoint: string; p256dh: string; auth: string }
export function endpointPermitido(raw: string) {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' || u.username || u.password || u.hash || u.port) return false
    const host = u.hostname.toLowerCase()
    return host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com'
      || host === 'web.push.apple.com' || host.endsWith('.notify.windows.com')
  } catch { return false }
}
export function crearHandler(env: Entorno, solicitar: typeof fetch = fetch) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405)
    const contexto = contextoServidor(env)
    if (!contexto) return json({ error: 'servicio_no_configurado' }, 503)
    const { key, url, headers } = contexto
    if (!igualConstante(req.headers.get('apikey') ?? '', key)) return json({ error: 'no_autorizado' }, 401)
    let body: Record<string, unknown>
    try {
      const valor: unknown = await req.json()
      if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error()
      body = valor as Record<string, unknown>
    } catch { return json({ error: 'parametros_invalidos' }, 400) }
    const { suscripcion_id: id, titulo, mensaje, tag } = body
    if (typeof id !== 'string' || !uuid.test(id)
      || typeof titulo !== 'string' || !titulo.trim() || [...titulo].length > 100
      || typeof mensaje !== 'string' || !mensaje.trim() || [...mensaje].length > 240
      || (tag !== undefined && (typeof tag !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(tag)))) {
      return json({ error: 'parametros_invalidos' }, 400)
    }
    const publica = env('VAPID_PUBLIC_KEY'), privada = env('VAPID_PRIVATE_KEY'), asunto = env('VAPID_SUBJECT')
    if (!publica || !privada || !asunto) return json({ error: 'vapid_no_configurado' }, 503)
    const target = `${url}/rest/v1/suscripciones_push`
    let s: Suscripcion
    try {
      const consulta = await solicitar(`${target}?id=eq.${encodeURIComponent(id)}&select=endpoint,p256dh,auth`,
        { headers, signal: AbortSignal.timeout(5000) })
      if (!consulta.ok) return json({ error: 'lectura_suscripcion_fallida' }, 502)
      const filas = await consulta.json() as Suscripcion[]
      if (!Array.isArray(filas)) throw new Error()
      if (!filas.length) return json({ error: 'suscripcion_no_existe' }, 404)
      if (filas.length !== 1) throw new Error()
      s = filas[0]
    } catch { return json({ error: 'lectura_suscripcion_fallida' }, 502) }
    if (!endpointPermitido(s.endpoint)) return json({ error: 'proveedor_push_no_permitido' }, 422)
    try {
      const solicitud = webpush.generateRequestDetails({ endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify({ title: titulo.trim(), body: mensaje.trim(), ...(tag ? { tag } : {}) }), {
        vapidDetails: { subject: asunto, publicKey: publica, privateKey: privada }, TTL: 60,
      })
      const respuesta = await solicitar(solicitud.endpoint, {
        method: solicitud.method, headers: solicitud.headers,
        body: new Uint8Array(solicitud.body), redirect: 'error', signal: AbortSignal.timeout(10000),
      })
      if (respuesta.ok) return json({ enviado: true })
      if (respuesta.status !== 404 && respuesta.status !== 410) return json({ error: 'envio_fallido' }, 502)
      // No borrar una suscripción renovada mientras respondía el proveedor.
      const baja = await solicitar(`${url}/rest/v1/rpc/baja_push_caducada`, {
        method: 'POST', headers, signal: AbortSignal.timeout(5000),
        body: JSON.stringify({ p_id: id, p_endpoint: s.endpoint, p_p256dh: s.p256dh, p_auth: s.auth }),
      })
      if (!baja.ok) return json({ error: 'baja_suscripcion_fallida' }, 502)
      return json({ enviado: false, motivo: 'suscripcion_caducada' }, 410)
    } catch { return json({ error: 'envio_fallido' }, 502) }
  }
}
