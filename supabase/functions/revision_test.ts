import { crearHandler as enviar, endpointPermitido } from './enviar-push/handler.ts'
import { crearHandler as procesar } from './procesar-avisos/handler.ts'
import { contextoServidor, json } from './_shared/servidor.ts'
import webpush from 'npm:web-push@3.6.7'
const id = '10000000-0000-4000-8000-000000000001'
const env = (nombre: string) => ({ SUPABASE_URL: 'http://supabase.test',
  SUPABASE_SECRET_KEYS: '{"default":"clave_simulada_de_test"}',
  VAPID_PUBLIC_KEY: 'publica', VAPID_PRIVATE_KEY: 'privada',
  VAPID_SUBJECT: 'mailto:dev@example.invalid' } as Record<string, string>)[nombre]
const req = (body: unknown = {}, key = 'clave_simulada_de_test') => new Request('http://local.test', {
  method: 'POST', headers: { apikey: key }, body: JSON.stringify(body),
})
const cuerpo = { suscripcion_id: id, titulo: 'Prueba', mensaje: 'Local' }
const aviso = { id, suscripcion_id: id, titulo: 'Prueba', mensaje: 'Local', token_reclamo: id }
const igual = (a: unknown, b: unknown) => { if (a !== b) throw new Error(`${a} != ${b}`) }
const sinRed: typeof fetch = () => { throw new Error('red simulada no disponible') }

Deno.test('envío rechaza null, arreglo, primitivo y UUID mal formado sin consultar red', async () => {
  for (const body of [null, [], 12, { ...cuerpo, suscripcion_id: '12345678----------------------------' }]) {
    igual((await enviar(env, sinRed)(req(body))).status, 400)
  }
})
Deno.test('autorización rechaza llave de usuario antes de red', async () => {
  igual((await enviar(env, sinRed)(req(cuerpo, 'usuario'))).status, 401)
  igual((await procesar(env, sinRed)(req({}, 'usuario'))).status, 401)
})
Deno.test('lectura de suscripción y reclamo sin red responden 502 controlado', async () => {
  igual((await enviar(env, sinRed)(req(cuerpo))).status, 502)
  igual((await procesar(env, sinRed)(req())).status, 502)
})
Deno.test('proveedores rechazan puertos alternos, credenciales y sufijos falsos', () => {
  for (const url of ['https://fcm.googleapis.com:8443/x', 'https://fcm.googleapis.com.evil.test/x',
    'https://x:y@fcm.googleapis.com/x', 'http://fcm.googleapis.com/x']) igual(endpointPermitido(url), false)
  igual(endpointPermitido('https://fcm.googleapis.com:443/x'), true)
})
Deno.test('credenciales legacy llevan apikey y Authorization; secret nueva solo apikey', () => {
  const legacy = (n: string) => n === 'SUPABASE_SERVICE_ROLE_KEY' ? 'eyJ.local.firma' :
    n === 'SUPABASE_URL' ? 'http://local.test' : undefined
  igual(contextoServidor(legacy)?.headers.Authorization, 'Bearer eyJ.local.firma')
  igual(contextoServidor(env)?.headers.Authorization, undefined)
  igual(contextoServidor(n => n === 'SUPABASE_SECRET_KEYS' ? '{"default":12}' : legacy(n))?.key,
    'eyJ.local.firma')
})
Deno.test('trabajador entrega tag estable y registra envío exitoso', async () => {
  const simulada: typeof fetch = async (url, init) => {
    if (String(url).endsWith('/tomar_avisos_push')) return json([aviso])
    const body = JSON.parse(String((init as RequestInit | undefined)?.body))
    if (String(url).endsWith('/enviar-push')) { igual(body.tag, id); return json({ enviado: true }) }
    igual(body.p_exito, true); igual(body.p_descartado, false)
    return json(true)
  }
  const r = await procesar(env, simulada)(req())
  igual(r.status, 200); igual((await r.json()).enviados, 1)
})
Deno.test('trabajador tolera cascada tras suscripción caducada sin marcar envío', async () => {
  const simulada: typeof fetch = async (url, init) => {
    if (String(url).endsWith('/tomar_avisos_push')) return json([aviso])
    if (String(url).endsWith('/enviar-push')) return json({ motivo: 'suscripcion_caducada' }, 410)
    const body = JSON.parse(String((init as RequestInit | undefined)?.body))
    igual(body.p_exito, false); igual(body.p_descartado, true)
    return json(false)
  }
  const r = await procesar(env, simulada)(req())
  igual(r.status, 200); igual((await r.json()).descartados, 1)
})
Deno.test('trabajador registra fallo de envío y controla caída durante cierre', async () => {
  const simulada: typeof fetch = async (url) => {
    if (String(url).endsWith('/tomar_avisos_push')) return json([aviso])
    if (String(url).endsWith('/enviar-push')) return json({ error: 'envio_fallido' }, 502)
    throw new Error('base caída')
  }
  igual((await procesar(env, simulada)(req())).status, 502)
})
Deno.test('baja de proveedor caducado compara claves para proteger una renovación', async () => {
  const vapid = webpush.generateVAPIDKeys()
  const receptor = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', receptor.publicKey))
  const b64 = (x: Uint8Array) => btoa(String.fromCharCode(...x)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
  const p256dh = b64(raw), auth = b64(crypto.getRandomValues(new Uint8Array(16)))
  const simulada: typeof fetch = async (url, init) => {
    if (String(url).endsWith('/baja_push_caducada')) {
      const body = JSON.parse(String((init as RequestInit | undefined)?.body))
      igual(body.p_p256dh, p256dh); igual(body.p_auth, auth)
      igual(new URL(String(url)).search, '')
      return json(false) // Una renovación concurrente impide borrar la fila.
    }
    if (String(url).includes('/rest/')) return json([{ endpoint: 'https://fcm.googleapis.com/fcm/send/test', p256dh, auth }])
    return new Response(null, { status: 410 })
  }
  const configurada = (n: string) => n === 'VAPID_PUBLIC_KEY' ? vapid.publicKey :
    n === 'VAPID_PRIVATE_KEY' ? vapid.privateKey : env(n)
  igual((await enviar(configurada, simulada)(req(cuerpo))).status, 410)
})
