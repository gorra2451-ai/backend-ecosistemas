// MÓDULO C · Mapa. Lógica pura (sin React ni red) para barra superior, hoja, sidebar y detalle de zona.
// Probada en mapa.test.js.

export const RADIO_TU_ZONA_M = 300      // radio de "tu zona" (copy del canvas: "a 300 m")
export const RADIO_CERCANO_M = 5000     // qué entra en "Lo cercano" (solo front · POR CONFIRMAR)
export const MAX_CERCANO = 6

const NIVEL_TXT = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' }
export const textoNivel = (n) => NIVEL_TXT[n] || 'Bajo'

// Distancia en metros entre dos puntos {lat,lng} (haversine).
export function distanciaM(a, b) {
  if (!a || !b) return Infinity
  const R = 6371000
  const rad = (g) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// 87 → "90 m", 1149 → "1.1 km"
export function formatoDist(m) {
  if (!Number.isFinite(m)) return ''
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`
  return `${(m / 1000).toFixed(1)} km`
}

// "justo ahora" · "hace 4 min" · "hace 2 h"
export function hace(fecha, ahora = Date.now()) {
  if (!fecha) return ''
  const t = typeof fecha === 'number' ? fecha : Date.parse(fecha)
  if (!Number.isFinite(t)) return ''
  const min = Math.max(0, Math.floor((ahora - t) / 60000))
  if (min < 1) return 'justo ahora'
  if (min < 60) return `hace ${min} min`
  return `hace ${Math.floor(min / 60)} h`
}

const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
const ORDEN_NIVEL = { alto: 3, medio: 2, bajo: 1 }

// Alerta de clima vigente para el municipio (la de nivel más alto).
export function lluviaPara(alertas, municipio) {
  const m = sinAcentos(municipio)
  const l = (alertas || []).filter((a) => sinAcentos(a.municipio) === m)
  l.sort((a, b) => (ORDEN_NIVEL[b.nivel] || 0) - (ORDEN_NIVEL[a.nivel] || 0))
  return l[0] || null
}
export function textoLluvia(alerta, municipio) {
  if (!alerta) return ''
  return [alerta.titulo || 'Aviso de lluvia', municipio].filter(Boolean).join(' · ')
}

// Lista de "Lo cercano": zonas + personas en riesgo, ordenadas por distancia.
export function loCercano({ zonas = [], reportes = [], ubic, radio = RADIO_CERCANO_M, max = MAX_CERCANO }) {
  const items = [
    ...zonas.map((z) => ({ clase: 'zona', id: 'z' + z.celda, nivel: z.nivel, dato: z, dist: distanciaM(ubic, z) })),
    ...reportes.filter((r) => r.tipo === 'persona_en_riesgo')
      .map((r) => ({ clase: 'riesgo', id: 'r' + r.id, nivel: 'riesgo', dato: r, dist: distanciaM(ubic, r) })),
  ].filter((i) => i.dist <= radio)
  items.sort((a, b) => a.dist - b.dist)
  return items.slice(0, max)
}

// Texto de cada fila: { t, m, lvl, cls }
export function filaCercana(item, ahora = Date.now()) {
  const d = formatoDist(item.dist)
  if (item.clase === 'riesgo') {
    const r = item.dato
    return { t: 'Persona en riesgo', m: [d, hace(r.ultima_confirmacion || r.creado_en, ahora)].filter(Boolean).join(' · '), lvl: 'Riesgo', cls: 'c-risk' }
  }
  const z = item.dato
  const carros = z.alguno_no_pasan_carros ? 'No pasan carros' : z.nivel === 'bajo' ? 'Pasan carros' : 'Pasan con cuidado'
  const reps = `${z.total_reportes} reporte${z.total_reportes === 1 ? '' : 's'}`
  return { t: `Zona con agua a ${d}`, m: `${carros} · ${reps}`, lvl: textoNivel(z.nivel), cls: 'p-' + z.nivel }
}

// Frase de estado de la barra superior / tarjeta del sidebar.
export function estadoZona({ zonas = [], ubic, municipio, revisado, ahora = Date.now() }) {
  const cerca = zonas.map((z) => ({ z, d: distanciaM(ubic, z) })).filter((x) => x.d <= RADIO_TU_ZONA_M)
  cerca.sort((a, b) => a.d - b.d)
  if (!cerca.length) {
    return { calma: true, frase: 'Tu zona: sin reportes', sub: [municipio, revisado && 'revisado ' + hace(revisado, ahora)].filter(Boolean).join(' · '), zona: null }
  }
  const n = cerca.length
  const peor = cerca.find((x) => x.z.alguno_no_pasan_carros || x.z.nivel === 'alto')
  const masReciente = cerca.map((x) => Date.parse(x.z.actualizado_en)).filter(Number.isFinite).sort((a, b) => b - a)[0]
  const sub = peor
    ? `No cruces: zona Alto a ${formatoDist(peor.d)}`
    : [municipio, masReciente && 'actualizado ' + hace(masReciente, ahora)].filter(Boolean).join(' · ')
  return {
    calma: false,
    frase: `${n} ${n === 1 ? 'calle inundada' : 'calles inundadas'} a ${RADIO_TU_ZONA_M} m`,
    sub, zona: (peor || cerca[0]).z,
  }
}

// Título de la hoja media según cómo se mueve (canvas App.dc.html).
export function tituloHoja(medio, calma) {
  if (calma) return 'Todo en calma'
  if (medio === 'auto') return '¿Sigo o cambio de ruta?'
  if (medio === 'transporte_publico') return 'Estado de tu zona'
  return '¿Salgo o espero?'
}

export const rutaGoogle = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

export function textoWhatsApp({ titulo, lat, lng }) {
  const t = `¡Aguas! ${titulo}. Ubicación: https://www.google.com/maps?q=${lat},${lng}`
  return `https://wa.me/?text=${encodeURIComponent(t)}`
}

// De los reportes_cercanos, el que se puede confirmar (no propio) más cercano al punto.
// Si se pasa `id`, prefiere ese reporte.
export function reporteParaConfirmar(cercanos, punto, id) {
  const l = (cercanos || []).filter((r) => !r.es_propio)
  if (id) { const e = l.find((r) => r.id === id); if (e) return e }
  return l.map((r) => ({ r, d: distanciaM(punto, r) })).sort((a, b) => a.d - b.d)[0]?.r || null
}
