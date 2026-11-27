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

// Rectángulo que cubre todas las rutas (+ margen) para pedir los reportes de TODO el trayecto, no solo los
// de cerca del origen y del destino (revisión de Leo: una inundación a mitad del camino no se detectaba).
export function areaDeRuta(listas = [], margenM = 200) {
  const pts = listas.flat()
  const lats = pts.map((c) => c[1]); const lngs = pts.map((c) => c[0])
  const minLat = Math.min(...lats); const maxLat = Math.max(...lats)
  const dLat = margenM / 111320
  const dLng = margenM / (111320 * Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180))
  return { min_lat: minLat - dLat, max_lat: maxLat + dLat, min_lng: Math.min(...lngs) - dLng, max_lng: Math.max(...lngs) + dLng }
}

// "Sin reportes en el camino" SOLO si de verdad se revisó todo el trayecto.
export function etiquetaCamino({ enCamino = [], revisada = false } = {}) {
  const n = enCamino.length
  const cuantos = n ? `${n} reporte${n === 1 ? '' : 's'} en el camino` : ''
  if (!revisada) return n ? `${cuantos} · no pudimos revisar todo el trayecto` : 'No pudimos revisar todo el trayecto'
  return cuantos || 'Sin reportes en el camino'
}

export function resumirRutas(rutas = [], reportes = [], revisada = false) {
  return rutas.map((r) => ({
    revisada,
    coords: r.geometry.coordinates,
    min: Math.max(1, Math.round(r.duration / 60)),
    km: (r.distance / 1000).toFixed(1),
    pasos: (r.legs?.[0]?.steps || []).map((s) => ({ texto: instruccion(s), m: Math.round(s.distance) })),
    enCamino: reportesEnRuta(r.geometry.coordinates, reportes),
  })).sort((a, b) => a.enCamino.length - b.enCamino.length || a.min - b.min)
}

// Une los reportes ya conocidos (incluye simulaciones del modo prueba) con los del área de la ruta, sin duplicar.
async function reportesDelTrayecto(rutas, conocidos, buscarReportes) {
  if (!buscarReportes) return { reportes: conocidos, revisada: false }
  try {
    const { data, error } = await buscarReportes(areaDeRuta(rutas.map((r) => r.geometry.coordinates)))
    if (error || !Array.isArray(data)) return { reportes: conocidos, revisada: false }
    const ids = new Set(conocidos.map((x) => x.id))
    return { reportes: [...conocidos, ...data.filter((x) => !ids.has(x.id))], revisada: true }
  } catch { return { reportes: conocidos, revisada: false } }
}

export async function buscarRutas(medio, origen, destino, reportes = [], f = fetch, buscarReportes = null) {
  let d
  try {
    const res = await f(urlRutas(perfilDeMedio(medio), redondearOrigen(origen), destino))
    d = await res.json()
  } catch { return { data: null, error: 'sin_red' } }
  if (d.code !== 'Ok' || !d.routes?.length) return { data: null, error: 'sin_ruta' }
  const t = await reportesDelTrayecto(d.routes, reportes, buscarReportes)
  return { data: resumirRutas(d.routes, t.reportes, t.revisada), error: null }
}

// ---------- Estado ÚNICO de rutas (store pequeño, como centrarEn) ----------
// Testeo: el panel decía "1 min · 0.2 km" y el mapa "11 min · 8.1 km". Causa: el panel y el mapa tenían
// copias distintas (el mapa guardaba la ruta vieja al cambiar de destino y una respuesta tardía de OSRM
// podía pisar la del destino nuevo). Ahora panel y mapa leen ESTE objeto; cambiar de destino lo borra.
// { seq, clave, destino, origen, medio, estado: 'buscando'|'listo'|'error', lista, elegida, enMapa }
let actual = null
let seq = 0
const subs = new Set()
const fijar = (e) => { actual = e; subs.forEach((fn) => fn()) }
export const leerRutas = () => actual
export const suscribirRuta = (fn) => { subs.add(fn); return () => subs.delete(fn) }
export const claveDestino = (d) => (d && Number.isFinite(+d.lat) && Number.isFinite(+d.lng) ? `${(+d.lat).toFixed(5)},${(+d.lng).toFixed(5)}` : '')
// Las rutas solo valen para el destino con el que se calcularon.
export const rutasPara = (e, destino) => (e && e.clave && e.clave === claveDestino(destino) ? e : null)
export const rutaActiva = (e = actual) => (e?.estado === 'listo' ? e.lista[e.elegida] || null : null)
// Si el punto de salida se movió (llegó el GPS real) la ruta ya no es la misma: recalcular.
export const debeRecalcular = (e, origen, umbralM = 150) =>
  !!(e && e.estado === 'listo' && origen && distanciaM(e.origen, redondearOrigen(origen)) > umbralM)

export async function pedirRutas({ medio, origen, destino, reportes = [], buscarReportes = null }, f = fetch) {
  const n = ++seq
  fijar({ seq: n, clave: claveDestino(destino), destino, origen: redondearOrigen(origen), medio,
    estado: 'buscando', lista: [], elegida: 0, enMapa: false })
  const r = await buscarRutas(medio, origen, destino, reportes, f, buscarReportes)
  if (actual?.seq !== n) return null // llegó tarde: ya se pidió otra ruta o se cambió de destino
  fijar({ ...actual, estado: r.error ? 'error' : 'listo', lista: r.data || [] })
  return actual
}
export const elegirRuta = (i) => { if (actual?.lista[i]) fijar({ ...actual, elegida: i }) }
export const verRutaEnMapa = (i = actual?.elegida ?? 0) => { if (actual?.lista[i]) fijar({ ...actual, elegida: i, enMapa: true }) }
export const quitarRuta = () => { seq++; fijar(null) }
// Al elegir otro destino: lo calculado para el anterior se borra (panel y mapa a la vez).
export const olvidarSiOtroDestino = (destino) => { if (actual && !rutasPara(actual, destino)) quitarRuta() }
export { distanciaM }
