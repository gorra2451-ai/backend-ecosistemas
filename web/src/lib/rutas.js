// Rutas dentro de la app (D-031): servidor OSRM de OpenStreetMap Alemania (FOSSGIS, gratis, sin llave, CORS).
// PRIVACIDAD: el origen sale redondeado a 3 decimales (~100 m); no se guarda en nuestra base.
// La ruta NO esquiva inundaciones sola: marcamos qué reportes quedan en cada camino para que elijas.
import { distanciaM } from './mapa.js'

const BASE = 'https://routing.openstreetmap.de'
export const perfilDeMedio = (m) => (m === 'peaton' ? 'foot' : m === 'bici' ? 'bike' : 'car')
export const redondearOrigen = (p) => ({ lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 })
export const urlRutas = (perfil, a, b) =>
  `${BASE}/routed-${perfil}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?alternatives=true&overview=full&geometries=geojson&steps=true`

const LADO = { left: 'a la izquierda', right: 'a la derecha', 'slight left': 'ligeramente a la izquierda',
  'slight right': 'ligeramente a la derecha', 'sharp left': 'fuerte a la izquierda', 'sharp right': 'fuerte a la derecha',
  straight: 'derecho', uturn: 'en U' }
export function instruccion(paso) {
  const m = paso?.maneuver || {}
  const en = paso?.name ? ` en ${paso.name}` : ''
  const lado = LADO[m.modifier] || ''
  switch (m.type) {
    case 'depart': return paso?.name ? `Sal por ${paso.name}` : 'Sal de tu punto'
    case 'arrive': return 'Llegaste a tu destino'
    case 'roundabout': case 'rotary':
      return `En la glorieta toma la salida ${m.exit || 1}${paso?.name ? ` hacia ${paso.name}` : ''}`
    case 'merge': return `Incorpórate ${lado}${en}`.replace('  ', ' ')
    case 'continue': case 'new name': return `Sigue ${lado || 'derecho'}${en}`
    case 'fork': return `En la bifurcación ve ${lado}${en}`
    case 'end of road': return `Al final de la calle gira ${lado}${en}`
    default: return m.modifier === 'straight' ? `Sigue derecho${en}` : `Gira ${lado}${en}`.trim()
  }
}

// Distancia de un punto a un tramo (aprox. plana, suficiente para < 2 km).
function distTramo(p, a, b) {
  const k = 111320; const c = Math.cos((p.lat * Math.PI) / 180)
  const P = [p.lng * k * c, p.lat * k]; const A = [a[0] * k * c, a[1] * k]; const B = [b[0] * k * c, b[1] * k]
  const dx = B[0] - A[0]; const dy = B[1] - A[1]
  const t = Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(P[0] - (A[0] + t * dx), P[1] - (A[1] + t * dy))
}
export function reportesEnRuta(coords = [], reportes = [], margen = 80) {
  return reportes.filter((r) => coords.some((c, i) => i > 0 && distTramo(r, coords[i - 1], c) <= margen))
}

export function resumirRutas(rutas = [], reportes = []) {
  return rutas.map((r) => ({
    coords: r.geometry.coordinates,
    min: Math.max(1, Math.round(r.duration / 60)),
    km: (r.distance / 1000).toFixed(1),
    pasos: (r.legs?.[0]?.steps || []).map((s) => ({ texto: instruccion(s), m: Math.round(s.distance) })),
    enCamino: reportesEnRuta(r.geometry.coordinates, reportes),
  })).sort((a, b) => a.enCamino.length - b.enCamino.length || a.min - b.min)
}

export async function buscarRutas(medio, origen, destino, reportes, f = fetch) {
  try {
    const res = await f(urlRutas(perfilDeMedio(medio), redondearOrigen(origen), destino))
    const d = await res.json()
    if (d.code !== 'Ok' || !d.routes?.length) return { data: null, error: 'sin_ruta' }
    return { data: resumirRutas(d.routes, reportes), error: null }
  } catch { return { data: null, error: 'sin_red' } }
}

// Ruta mostrada en el mapa (store pequeño, como centrarEn).
let actual = null
const subs = new Set()
export const leerRuta = () => actual
export const suscribirRuta = (fn) => { subs.add(fn); return () => subs.delete(fn) }
export const mostrarRuta = (r) => { actual = r; subs.forEach((fn) => fn()) }
export { distanciaM }
