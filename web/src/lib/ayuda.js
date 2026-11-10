// Módulo E · lógica pura (sin navegador ni red) de derivación, refugios y avisos. Probada en ayuda.test.js.

export const MUNICIPIOS_ZMG = ['Guadalajara', 'Zapopan', 'Tlaquepaque', 'Tonalá', 'Tlajomulco', 'El Salto']

// Casos del contrato de `derivar` (docs/API.md) + título del canvas (App.dc.html · acudoresp).
export const CASOS = {
  casa: 'Se metió el agua a mi casa',
  coche: 'Mi coche quedó en el agua',
  persona_herida: 'Hay una persona herida',
  tercero: 'Le pasó a otra persona',
  otro: 'Otro problema por la lluvia',
}
// Instituciones de ejemplo del canvas: solo nombres genéricos, SIN teléfonos (P-05/P-07).
export const INST_EJEMPLO = {
  casa: ['Protección Civil municipal', 'Atención ciudadana municipal'],
  coche: ['Protección Civil municipal', 'Tránsito / vialidad municipal'],
  persona_herida: ['Cruz Roja (delegación local)', 'Protección Civil municipal'],
  tercero: ['Protección Civil municipal', 'Cruz Roja (delegación local)'],
  otro: ['Protección Civil municipal', 'Atención ciudadana municipal'],
}

// Acepta alias que usan otros módulos/canvas ('herida', 'persona') y cae en 'otro' si no lo conoce.
export function normalizarCaso(c) {
  const k = String(c || '').toLowerCase()
  if (k === 'herida' || k === 'persona') return 'persona_herida'
  return CASOS[k] ? k : 'otro'
}

// Distancia en metros (haversine).
export function distanciaM(a, b) {
  if (!a || !b || [a.lat, a.lng, b.lat, b.lng].some((v) => typeof v !== 'number' || Number.isNaN(v))) return null
  const R = 6371000, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatoDistancia(m) {
  if (m == null) return ''
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`
  return `${(m / 1000).toFixed(1)} km`
}

// Agrega `distancia_m` (si no viene del backend) y ordena del más cercano al más lejano.
export function ordenarPorDistancia(lista, desde) {
  return (lista || [])
    .map((r) => ({ ...r, distancia_m: r.distancia_m ?? distanciaM(desde, r) }))
    .sort((a, b) => (a.distancia_m ?? Infinity) - (b.distancia_m ?? Infinity))
}

export const urlRuta = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

// Llave VAPID pública (base64url) → Uint8Array para PushManager.subscribe.
export function base64UrlABytes(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

// El backend acepta UN municipio por dispositivo (mismo endpoint = misma suscripción).
// Usamos el municipio actual si está elegido; si no, el primero elegido; si no hay ninguno, el actual.
export function municipioParaPush(elegidos, actual) {
  const on = MUNICIPIOS_ZMG.filter((m) => elegidos?.[m])
  if (on.includes(actual)) return actual
  return on[0] || actual
}
