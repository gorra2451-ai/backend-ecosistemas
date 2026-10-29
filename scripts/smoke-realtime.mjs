// Prueba local de Broadcast por WebSocket. No imprime llaves ni tokens.
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const status = JSON.parse(execSync('supabase status --output json', {
  encoding: 'utf8', env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' }
}))
const api = status.API_URL.replace(/\/$/, '')
const key = status.PUBLISHABLE_KEY
if (!api || !key) throw new Error('Supabase local no está disponible')

const wsUrl = new URL(api.replace(/^http/, 'ws') + '/realtime/v1/websocket')
wsUrl.searchParams.set('apikey', key)
wsUrl.searchParams.set('vsn', '1.0.0')
const ws = new WebSocket(wsUrl)
const joins = new Map()
const broadcasts = []

ws.addEventListener('message', ({ data }) => {
  const msg = JSON.parse(data)
  if (msg.event === 'phx_reply' && joins.has(msg.ref)) {
    const { resolve, reject } = joins.get(msg.ref)
    joins.delete(msg.ref)
    msg.payload?.status === 'ok' ? resolve() : reject(new Error('Realtime rechazó el canal'))
  }
  if (msg.event === 'broadcast') broadcasts.push(msg)
})

function waitForOpen() {
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', () => reject(new Error('No abrió WebSocket local')), { once: true })
  })
}

function join(topic, ref) {
  return new Promise((resolve, reject) => {
    joins.set(ref, { resolve, reject })
    ws.send(JSON.stringify({ topic: `realtime:${topic}`, event: 'phx_join', ref,
      join_ref: ref, payload: { config: { private: false,
        broadcast: { ack: false, self: false }, presence: { enabled: false },
        postgres_changes: [] } } }))
  })
}

async function esperarEventos(reporteId) {
  const hasta = Date.now() + 10000
  while (Date.now() < hasta) {
    const reporte = broadcasts.find(m => m.topic === 'realtime:reportes'
      && m.payload?.event === 'cambio' && m.payload?.payload?.id === reporteId)
    const zona = broadcasts.find(m => m.topic === 'realtime:zonas'
      && m.payload?.event === 'cambio' && m.payload?.payload?.celda)
    if (reporte && zona) return { reporte, zona }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`No llegaron ambos Broadcast (recibidos: ${broadcasts.map(m => m.topic).join(', ')})`)
}

try {
  await waitForOpen()
  await Promise.all([join('reportes', '1'), join('zonas', '2')])
  const alta = await fetch(`${api}/auth/v1/signup`, { method: 'POST',
    headers: { apikey: key, 'content-type': 'application/json' }, body: '{"data":{}}' })
  const sesion = await alta.json()
  if (!alta.ok || !sesion.access_token) throw new Error('Auth anónima falló')
  const reporteId = randomUUID()
  const crear = await fetch(`${api}/rest/v1/rpc/crear_reporte`, { method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${sesion.access_token}`,
      'content-type': 'application/json' },
    body: JSON.stringify({ p_id: reporteId, p_tipo: 'persona_en_riesgo',
      p_pasan_carros: false, p_lat: 20.94, p_lng: -103.60, p_precision_m: 20 }) })
  const resultado = await crear.json()
  if (!crear.ok || resultado.estado !== 'activo') throw new Error('No se activó reporte de prueba')
  const { reporte, zona } = await esperarEventos(reporteId)
  const payload = reporte.payload.payload
  if (payload.estado !== 'activo' || 'perfil_id' in payload || 'ubicacion' in payload
      || !zona.payload.payload.celda) throw new Error('Payload de Broadcast incorrecto')
  console.log('OK: Broadcast real de reporte y zona recibido sin autor ni ubicación precisa.')
} finally {
  ws.close()
}
