// MÓDULO C · Mapa. Lógica pura (sin React ni red) para barra superior, hoja, sidebar y detalle de zona.
// Probada en mapa.test.js.

export const RADIO_TU_ZONA_M = 300      // radio de "tu zona" (copy del canvas: "a 300 m")
export const RADIO_CERCANO_M = 5000     // qué entra en "Lo cercano" (solo front · POR CONFIRMAR)
export const MAX_CERCANO = 6

// Niveles v2 (API_V2 · confirmaciones "sí"): bajo 5–9 · medio 10–14 · alto 15–19 · crítico ≥ 20.
export const NIVELES = ['bajo', 'medio', 'alto', 'critico']
const NIVEL_TXT = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto', critico: 'Crítico' }
export const textoNivel = (n) => NIVEL_TXT[n] || 'Bajo'
// Como nivelDeZona de api.js, pero reconoce 'critico' (con o sin acento).
export function nivelV2(x) {
  const n = String(x?.nivel || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return NIVELES.includes(n) ? n : 'bajo'
}
const esGrave = (z) => z.nivel === 'alto' || z.nivel === 'critico'

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
const ORDEN_NIVEL = { critico: 4, alto: 3, medio: 2, bajo: 1 }

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

// Categoría y tránsito con el copy del equipo Mapa (Cauce ZMG, pantallas 5–7).
// gravedad v2: bloqueado → Cierre vial / No transitable · limitado → Zona de riesgo / con precaución ·
// sin_riesgo → Encharcamiento. Las zonas no traen gravedad: "no pasan carros" → No transitable.
const CATEGORIA = { bloqueado: 'Cierre vial', limitado: 'Zona de riesgo', sin_riesgo: 'Encharcamiento' }
export function transito(x) {
  if (x?.gravedad === 'bloqueado' || x?.alguno_no_pasan_carros || x?.pasan_carros === false) return { txt: 'No transitable', cls: 'no' }
  if (x?.gravedad === 'sin_riesgo' || x?.gravedad === 'limitado' || x?.alguno_no_pasan_carros === false || x?.pasan_carros === true) {
    return { txt: 'Transitable con precaución', cls: 'prec' }
  }
  return { txt: 'Sin información suficiente', cls: 'sin' }
}
// Sin el prefijo de simulación: las tarjetas muestran "SIMULACIÓN" como etiqueta aparte, arriba del título.
export const categoriaBase = (x) => (x?.tipo === 'persona_en_riesgo' ? 'Persona en riesgo' : CATEGORIA[x?.gravedad] || 'Inundación')
export function categoria(x) {
  return (x?.simulada ? 'Simulación · ' : '') + categoriaBase(x)
}
const plural = (n, s) => `${n} ${s}${n === 1 ? '' : 's'}`

// Estado de verificación, aparte del nivel de riesgo (testeo: "Sin confirmar" se leyó como "menos riesgo").
// Las zonas públicas ya están confirmadas por la gente; un reporte 'pendiente' todavía no.
export const VERIF_OK = { txt: 'Confirmado', cls: 'ok' }
export const VERIF_SIN = { txt: 'Sin confirmar · aún nadie lo confirma', cls: 'sin' }
export const verificacion = (x) => (x?.estado === 'pendiente' ? VERIF_SIN : VERIF_OK)

// Texto de cada fila de "Alertas": { t, lugar, lvl, nivel, cls, transito, m, verif, tipo, sim }
export function filaCercana(item, ahora = Date.now(), desde = 'de ti') {
  const lugar = `A ${formatoDist(item.dist)} ${desde}`
  if (item.clase === 'riesgo') {
    const r = item.dato
    const act = hace(r.ultima_confirmacion || r.creado_en, ahora)
    return { t: 'Persona en riesgo', lugar, lvl: 'Riesgo', nivel: 'Persona en riesgo', cls: 'c-risk', transito: null,
      m: act ? 'Actualizado ' + act : '', verif: verificacion(r), tipo: 'persona_en_riesgo', sim: !!r.simulada }
  }
  const z = item.dato
  const act = hace(z.actualizado_en, ahora)
  return {
    t: categoriaBase(z), lugar, lvl: textoNivel(z.nivel), nivel: 'Riesgo ' + textoNivel(z.nivel).toLowerCase(), cls: 'p-' + z.nivel,
    transito: transito(z), verif: verificacion(z), tipo: z.tipo || null, sim: !!z.simulada,
    m: [act && 'Actualizado ' + act, plural(z.total_reportes ?? 0, 'reporte')].filter(Boolean).join(' · '),
  }
}

// 14:05 (24 h, hora local). '' si no hay fecha.
export function textoHora(t) {
  const d = t == null ? null : new Date(t)
  if (!d || !Number.isFinite(d.getTime())) return ''
  const dos = (n) => String(n).padStart(2, '0')
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`
}

// Frase de estado de la barra superior / tarjeta del sidebar.
// Testeo (9 de 10): "Tu zona: sin reportes" se leyó como "zona segura". Ahora nombra la zona, dice que sin
// reportes no es sin riesgo y da la hora de los datos (nada de "revisado justo ahora" ni "tiempo real").
// Sin GPS real (ubic.real === false) habla del punto de ejemplo, no de "tu zona".
export const AVISO_SIN_REPORTES = 'Sin reportes no significa sin riesgo'
export function estadoZona({ zonas = [], ubic, municipio, revisado, ahora = Date.now() }) {
  const ejemplo = ubic?.real === false
  const donde = ejemplo ? 'Punto de ejemplo · no es tu ubicación' : (municipio || '')
  const hora = revisado ? `Reportes actualizados a las ${textoHora(revisado)}` : ''
  const cerca = zonas.map((z) => ({ z, d: distanciaM(ubic, z) })).filter((x) => x.d <= RADIO_TU_ZONA_M)
  cerca.sort((a, b) => a.d - b.d)
  if (!cerca.length) {
    const frase = ejemplo ? 'Sin reportes registrados cerca del punto de ejemplo'
      : municipio ? `Sin reportes registrados en ${municipio}` : 'Sin reportes registrados cerca de ti'
    return { calma: true, frase, aviso: AVISO_SIN_REPORTES, sub: hora, hora, donde, ejemplo, zona: null }
  }
  const n = cerca.length
  const peor = cerca.find((x) => esGrave(x.z)) || cerca.find((x) => x.z.alguno_no_pasan_carros)
  const masReciente = cerca.map((x) => Date.parse(x.z.actualizado_en)).filter(Number.isFinite).sort((a, b) => b - a)[0]
  const sub = peor
    ? `No cruces: zona ${textoNivel(esGrave(peor.z) ? peor.z.nivel : 'alto')} a ${formatoDist(peor.d)}`
    : [municipio, masReciente && 'actualizado ' + hace(masReciente, ahora)].filter(Boolean).join(' · ')
  return {
    calma: false, hora, donde, ejemplo,
    // Distancia REAL a la más cercana (antes decía siempre "a 300 m", el radio de tu zona).
    frase: n === 1 ? `1 calle inundada a ${formatoDist(cerca[0].d)}` : `${n} calles inundadas · la más cerca a ${formatoDist(cerca[0].d)}`,
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

// Sin ruteo propio (D-020 / brief R3): Google Maps calcula la ruta. Ojo: Google no conoce nuestras zonas.
export const rutaGoogle = (lat, lng, modo = 'driving') =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${modo}`

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

// ---------- Capas del mapa (filtros) · store propio, sin React ----------
// Lo leen la lista "Lo cercano" (Mapa.jsx) y MapView (vía usarCapas). Solo front: no se guarda en backend.
export const CAPAS_INICIALES = Object.freeze({ bajo: true, medio: true, alto: true, critico: true, riesgo: true, refugios: true, misReportes: true })
let capas = { ...CAPAS_INICIALES }
const oyentes = new Set()
const avisarCapas = () => oyentes.forEach((f) => f())

export const leerCapas = () => capas
export function cambiarCapa(clave, valor) {
  if (!(clave in CAPAS_INICIALES)) return
  capas = { ...capas, [clave]: valor ?? !capas[clave] }
  avisarCapas()
}
export function restablecerCapas() { capas = { ...CAPAS_INICIALES }; avisarCapas() }
export function suscribirCapas(f) { oyentes.add(f); return () => oyentes.delete(f) }
export const capasModificadas = (c = capas) => Object.keys(CAPAS_INICIALES).some((k) => c[k] !== CAPAS_INICIALES[k])
// Indicador fijo sobre el mapa (testeo: nadie notaba que había filtros puestos).
export const filtrosActivos = (c = capas) => Object.keys(CAPAS_INICIALES).filter((k) => c[k] !== CAPAS_INICIALES[k]).length
export const textoFiltros = (n) => (n > 0 ? `Filtros: ${n} ${n === 1 ? 'activo' : 'activos'}` : '')

// Nivel de agua de un pin (mismo criterio que lib/pines.js: primero la gravedad reportada; crítico → alto).
const nivelDeReporte = (r) => nivelAgua(r) || (nivelV2(r) === 'critico' ? 'alto' : nivelV2(r))

// Aplica las capas a los datos del mapa. Zonas y pines por nivel; persona en riesgo tiene su propia capa.
export function filtrarCapas({ zonas = [], reportes = [], refugios = [], misReportes = [] }, c = capas) {
  return {
    zonas: zonas.filter((z) => c[z.nivel] !== false),
    reportes: reportes.filter((r) => (r.tipo === 'persona_en_riesgo' ? c.riesgo : c[nivelDeReporte(r)] !== false)),
    refugios: c.refugios ? refugios : [],
    misReportes: c.misReportes ? misReportes : [],
  }
}

// ---------- Centrar el mapa en un lugar buscado · store propio, sin React ----------
// Lo escribe Buscar (Mapa.jsx) y lo lee MapView (diff en scratch/mapview_r3.diff). { lat, lng, nombre, seq } | null
let centro = null
let seqCentro = 0
const oyentesCentro = new Set()
export const leerCentro = () => centro
export function centrarEn(lugar) {
  centro = lugar && Number.isFinite(lugar.lat) && Number.isFinite(lugar.lng)
    ? { lat: lugar.lat, lng: lugar.lng, nombre: lugar.nombre || '', seq: ++seqCentro } : null
  oyentesCentro.forEach((f) => f())
}
export function suscribirCentro(f) { oyentesCentro.add(f); return () => oyentesCentro.delete(f) }

// Debounce simple (Buscar: 600 ms para respetar 1 petición/s de Nominatim). .cancelar() lo detiene.
export function debounce(fn, ms = 600) {
  let t = null
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => { t = null; fn(...a) }, ms) }
  d.cancelar = () => { clearTimeout(t); t = null }
  return d
}

// "Plaza del Sol, Jardines del Sol, Zapopan" → { t: 'Plaza del Sol', sub: 'Jardines del Sol, Zapopan' }
export function partirLugar(nombre) {
  const [t, ...resto] = String(nombre || '').split(',').map((x) => x.trim()).filter(Boolean)
  return { t: t || 'Lugar sin nombre', sub: resto.join(', ') }
}

// Etiquetas del mapa: las celdas miden 300 m y una etiqueta ocupa ~550 m a zoom 15, así que dos
// celdas contiguas se enciman. Se etiqueta primero la más grave y se salta la que quede a < sepM.
export function zonasConEtiqueta(zonas = [], max = 3, sepM = 700) {
  const orden = [...zonas].sort((a, b) => NIVELES.indexOf(b.nivel) - NIVELES.indexOf(a.nivel))
  const elegidas = []
  for (const z of orden) {
    if (elegidas.length >= max) break
    if (elegidas.every((e) => distanciaM(e, z) >= sepM)) elegidas.push(z)
  }
  return elegidas
}

// Conteo por nivel para el resumen de la hoja (D-028): [['riesgo', 1], ['alto', 2], …] en orden de gravedad, sin ceros.
const ORDEN_RESUMEN = ['riesgo', 'critico', 'alto', 'medio', 'bajo']
export function resumenNiveles(items = []) {
  const c = {}
  items.forEach((it) => { const k = it.clase === 'riesgo' ? 'riesgo' : nivelV2(it.dato); c[k] = (c[k] || 0) + 1 })
  return ORDEN_RESUMEN.filter((k) => c[k]).map((k) => [k, c[k]])
}

// D-029 · Una sola escala: el nivel que se MUESTRA es la altura del agua que reportó la gente (banqueta / media
// llanta / cubre la llanta), no cuántos confirmaron. Las confirmaciones se muestran aparte ("Confirmado por N").
const NIVEL_DE_GRAVEDAD = { sin_riesgo: 'bajo', limitado: 'medio', bloqueado: 'alto' }
const RANGO_AGUA = ['bajo', 'medio', 'alto']
export const nivelAgua = (r) => NIVEL_DE_GRAVEDAD[r?.gravedad] || null
export function zonasConNivelAgua(zonas = [], reportes = [], radio = 220) {
  return zonas.map((z) => {
    const peorRep = reportes
      .filter((r) => r.tipo !== 'persona_en_riesgo' && distanciaM(z, r) <= radio && nivelAgua(r))
      .sort((a, b) => RANGO_AGUA.indexOf(nivelAgua(b)) - RANGO_AGUA.indexOf(nivelAgua(a)))[0]
    const peor = peorRep ? nivelAgua(peorRep) : null
    const porConfirmacion = nivelV2(z)
    const respaldo = z.alguno_no_pasan_carros ? 'alto' : porConfirmacion === 'critico' ? 'alto' : porConfirmacion
    // tipo: el del reporte que define el nivel, para usar el mismo ícono que el pin del mapa (null si no se sabe).
    return { ...z, nivel_confirmacion: porConfirmacion, nivel: peor || respaldo, tipo: z.tipo || peorRep?.tipo || null }
  })
}

// ---------- Cómo me muevo hoy (testeo: 4 de 10 no encontraron el selector) ----------
const MEDIO_CORTO = { peaton: 'A pie', moto: 'En moto', bici: 'En bici', auto: 'En auto', transporte_publico: 'En bus' }
const MEDIO_AVISO = { peaton: 'ir a pie', moto: 'moto', bici: 'bici', auto: 'auto', transporte_publico: 'transporte público' }
export const etiquetaMedio = (m) => MEDIO_CORTO[m] || MEDIO_CORTO.peaton
export const avisoMedio = (m) => `Alertas adaptadas para ${MEDIO_AVISO[m] || MEDIO_AVISO.peaton}`

// ---------- Centrar un pin en la parte VISIBLE del mapa (no debajo de la hoja ni del panel) ----------
// tam = {w,h} del mapa; tapado = px cubiertos {top,bottom,left,right}. Devuelve cuánto se corre el centro
// visible respecto al centro del mapa. Si lo tapado no deja espacio, no corre nada.
export function centroVisible(tam, tapado = {}) {
  const { top = 0, bottom = 0, left = 0, right = 0 } = tapado
  const libreW = tam.w - left - right
  const libreH = tam.h - top - bottom
  const dx = libreW > 40 ? left + libreW / 2 - tam.w / 2 : 0
  const dy = libreH > 40 ? top + libreH / 2 - tam.h / 2 : 0
  return { dx: Math.round(dx) || 0, dy: Math.round(dy) || 0 }
}

// Store: pedir que el mapa enfoque un punto (alerta elegida). { lat, lng, seq } | null. Lo lee MapView.
let enfoque = null
let seqEnfoque = 0
const oyentesEnfoque = new Set()
export const leerEnfoque = () => enfoque
export function enfocarEn(p) {
  enfoque = p && Number.isFinite(p.lat) && Number.isFinite(p.lng) ? { lat: p.lat, lng: p.lng, seq: ++seqEnfoque } : null
  oyentesEnfoque.forEach((f) => f())
}
export function suscribirEnfoque(f) { oyentesEnfoque.add(f); return () => oyentesEnfoque.delete(f) }

// Store: panel "Leyenda del mapa" / "Filtrar reportes". 'leyenda' | 'filtros' | null.
let panel = null
const oyentesPanel = new Set()
export const leerPanel = () => panel
export function abrirPanel(p) {
  panel = p == null ? null : p === 'filtros' ? 'filtros' : 'leyenda'
  oyentesPanel.forEach((f) => f())
}
export function suscribirPanel(f) { oyentesPanel.add(f); return () => oyentesPanel.delete(f) }
