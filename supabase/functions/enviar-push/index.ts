// F4-T1: envío Web Push interno. No acepta JWTs de usuarios como autorización.
import webpush from 'npm:web-push@3.6.7'

type Suscripcion = { endpoint: string; p256dh: string; auth: string }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8' },
})

function secreto() {
  const actuales = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (actuales) {
    try { return (JSON.parse(actuales) as Record<string, string>).default }
    catch { /* La configuración incompleta se informa como 503. */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}

function igualConstante(a: string, b: string) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let distinto = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    distinto |= (x[i] ?? 0) ^ (y[i] ?? 0)
  }
  return distinto === 0
}

function endpointPermitido(raw: string) {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' || u.username || u.password || u.hash) return false
    const host = u.hostname.toLowerCase()
    return host === 'fcm.googleapis.com'
      || host === 'updates.push.services.mozilla.com'
      || host === 'web.push.apple.com'
      || host.endsWith('.notify.windows.com')
  } catch { return false }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405)
  const key = secreto()
  const url = Deno.env.get('SUPABASE_URL')
  if (!key || !url) return json({ error: 'servicio_no_configurado' }, 503)
  if (!igualConstante(req.headers.get('apikey') ?? '', key)) {
    return json({ error: 'no_autorizado' }, 401)
  }

  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return json({ error: 'parametros_invalidos' }, 400) }
  const id = body.suscripcion_id
  const titulo = body.titulo
  const mensaje = body.mensaje
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(id)
      || typeof titulo !== 'string' || !titulo.trim() || titulo.length > 100
      || typeof mensaje !== 'string' || !mensaje.trim() || mensaje.length > 240) {
    return json({ error: 'parametros_invalidos' }, 400)
  }

  const vapidPublica = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivada = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidAsunto = Deno.env.get('VAPID_SUBJECT')
  if (!vapidPublica || !vapidPrivada || !vapidAsunto) {
    return json({ error: 'vapid_no_configurado' }, 503)
  }

  const target = `${url.replace(/\/$/, '')}/rest/v1/suscripciones_push`
  const filtro = `?id=eq.${encodeURIComponent(id)}&select=endpoint,p256dh,auth`
  const headers = { apikey: key, accept: 'application/json' }
  const consulta = await fetch(target + filtro, { headers })
  if (!consulta.ok) return json({ error: 'lectura_suscripcion_fallida' }, 502)
  const filas = await consulta.json() as Suscripcion[]
  if (filas.length !== 1) return json({ error: 'suscripcion_no_existe' }, 404)
  const s = filas[0]
  if (!endpointPermitido(s.endpoint)) return json({ error: 'proveedor_push_no_permitido' }, 422)

  try {
    const solicitud = webpush.generateRequestDetails({ endpoint: s.endpoint,
      keys: { p256dh: s.p256dh, auth: s.auth } },
    JSON.stringify({ title: titulo.trim(), body: mensaje.trim() }), {
      vapidDetails: { subject: vapidAsunto, publicKey: vapidPublica,
        privateKey: vapidPrivada }, TTL: 60,
    })
    // fetch nativo funciona en Edge Runtime; no depende del cliente HTTPS de Node.
    const respuesta = await fetch(solicitud.endpoint, {
      method: solicitud.method, headers: solicitud.headers,
      body: new Uint8Array(solicitud.body), redirect: 'error',
      signal: AbortSignal.timeout(10000),
    })
    if (respuesta.ok) return json({ enviado: true })
    if (respuesta.status !== 404 && respuesta.status !== 410) {
      return json({ error: 'envio_fallido' }, 502)
    }
    const borrado = await fetch(target + `?id=eq.${encodeURIComponent(id)}`,
      { method: 'DELETE', headers })
    if (!borrado.ok) return json({ error: 'baja_suscripcion_fallida' }, 502)
    return json({ enviado: false, motivo: 'suscripcion_caducada' }, 410)
  } catch (error) {
    // No se registran endpoints, claves ni cuerpos de respuesta del proveedor.
    void error
    return json({ error: 'envio_fallido' }, 502)
  }
})
