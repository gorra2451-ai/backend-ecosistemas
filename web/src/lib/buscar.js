// Lógica pura de la pantalla Buscar (Mapa.jsx · Buscar/PanelRutas). Probada en buscar.test.js.
import { ALIAS, normalizar } from './alias.js'

// Atajos que sí existen en OpenStreetMap (los mismos de la pantalla vacía).
export const POPULARES = ['Glorieta Minerva, Guadalajara', 'Centro Histórico, Guadalajara', 'Plaza del Sol',
  'Expo Guadalajara', 'Parque Revolución, Guadalajara', 'Zapopan Centro', 'Colonia Americana', 'Av. López Mateos']

// Mientras escribe: aviso junto al campo si lleva 1 o 2 letras.
export const avisoCorto = (q) => { const n = String(q ?? '').trim().length; return n > 0 && n < 3 ? 'Escribe al menos 3 letras' : null }

// Sin resultados: 2–3 sugerencias tocables. Primero apodos que se parezcan a lo escrito, luego populares.
export function sugerenciasSinResultado(q, max = 3) {
  const n = normalizar(q)
  const parecidos = n.length >= 3
    ? Object.entries(ALIAS).filter(([k]) => k.includes(n) || n.includes(k)).map(([, v]) => v) : []
  return [...new Set([...parecidos, ...POPULARES])].slice(0, max)
}

// Un lugar (resultado de buscarLugar, o destino {lat,lng,nombre} que llega del detalle de una alerta)
// → { nombre, detalle, municipio, categoria } para encabezado "Nombre · Municipio" y resultados.
export function vistaLugar(l) {
  if (!l) return { nombre: '', detalle: '', municipio: '', categoria: null }
  if (l.titulo) return { nombre: l.titulo, detalle: l.direccion || '', municipio: l.municipio || '', categoria: l.categoria || null }
  const partes = String(l.nombre || '').split(',').map((x) => x.trim()).filter(Boolean)
  const nombre = partes[0] || 'Lugar sin nombre'
  const municipio = partes.length > 1 ? partes[partes.length - 1] : ''
  return { nombre, detalle: partes.slice(1, -1).join(', '), municipio, categoria: null }
}
export const encabezadoLugar = (l) => { const v = vistaLugar(l); return [v.nombre, v.municipio].filter(Boolean).join(' · ') }

// "En el camino: 2 reportes · En el destino: sin reportes registrados" (testeo: no mezclar camino y destino).
const nRep = (n) => `${n} reporte${n === 1 ? '' : 's'}`
export function estadoCaminoDestino({ enCamino = null, enDestino = 0, revisada = true } = {}) {
  const destino = `En el destino: ${enDestino ? nRep(enDestino) + ' cerca' : 'sin reportes registrados'}`
  if (enCamino == null) return destino
  const camino = !revisada
    ? (enCamino ? `${nRep(enCamino)}, no pudimos revisar todo el trayecto` : 'no pudimos revisar todo el trayecto')
    : (enCamino ? nRep(enCamino) : 'sin reportes')
  return `En el camino: ${camino} · ${destino}`
}
