// Módulo E · lógica pura (sin navegador ni red) de derivación, refugios y avisos. Probada en ayuda.test.js.

export const MUNICIPIOS_ZMG = ['Guadalajara', 'Zapopan', 'Tlaquepaque', 'Tonalá', 'Tlajomulco', 'El Salto']

// Casos de "Me pasó algo" (Equipo 5, ronda 3) → `tipo_caso` de `derivar` (contrato v2).
export const CASOS_EQUIPO = ['casa', 'calle', 'coche', 'persona_herida', 'arbol_caido', 'riesgo_electrico']
export const CASOS = {
  casa: 'Mi casa se inundó',
  calle: 'Calle inundada (no pasar)',
  coche: 'Mi carro se quedó atorado',
  persona_herida: 'Persona herida',
  arbol_caido: 'Árbol caído / obstáculo',
  riesgo_electrico: 'Riesgo eléctrico',
  tercero: 'Le pasó a otra persona', // v1: siguen en el contrato; ya no están en la pantalla del equipo
  otro: 'Otro problema por la lluvia',
}

// Textos del equipo (notificaciones.html · SIT). Sin teléfonos inventados: solo 911 (real) y CFE 071 (por confirmar).
export const SITUACIONES = {
  casa: { n: 'Mi casa se inundó', who: 'Protección Civil', call: 'Llamar a Protección Civil', num: 'Protección Civil · marca 911', say: 'se metió el agua a mi casa', extra: 'Ver guía: qué hacer si se inunda tu casa', ref: true, guide: 'Sube a un lugar alto, corta la luz desde el interruptor general si puedes hacerlo seco y no camines en agua con corriente.' },
  calle: { n: 'Calle inundada', who: 'No pases: repórtala', call: 'Llamar a Protección Civil', num: 'Protección Civil · marca 911', say: 'la calle está inundada y no se puede pasar', extra: 'Ver rutas alternas', ref: true, rutas: true, guide: null },
  coche: { n: 'Carro atorado', who: 'Protección Civil y Bomberos', call: 'Llamar a Protección Civil', num: 'Protección Civil y Bomberos · marca 911', say: 'mi carro se quedó atorado en el agua', extra: 'Ver guía: qué hacer en mi carro', guide: 'Si el agua sube, sal del carro y busca un punto alto. No intentes empujarlo con corriente.' },
  persona_herida: { n: 'Persona herida', who: 'Servicios de emergencia', call: 'Llamar a Cruz Roja', num: 'Emergencias · marca 911', say: 'hay una persona herida', extra: 'Ver guía de primeros auxilios', guide: 'No muevas a la persona si pudo haberse golpeado la cabeza o la espalda. Mantenla abrigada hasta que llegue ayuda.' },
  arbol_caido: { n: 'Árbol caído u obstáculo', who: 'Protección Civil municipal', call: 'Llamar a Protección Civil', num: 'Protección Civil · marca 911', say: 'un árbol caído bloquea la calle', extra: 'Ver guía: qué hacer', guide: 'No intentes moverlo. Aléjate de cables que puedan estar enredados y avisa a otros conductores.' },
  riesgo_electrico: { n: 'Riesgo eléctrico', who: 'CFE (reporte 071)', call: 'Llamar a CFE · 071', tel: '071', telPorConfirmar: true, num: 'CFE · marca 071 · emergencias al 911', say: 'hay cables caídos con riesgo eléctrico', extra: 'Ver guía: qué hacer', guide: 'Aléjate al menos 10 metros de cables caídos y no toques agua cerca de ellos.' },
  tercero: { n: 'Le pasó a otra persona', who: 'Servicios de emergencia', call: null, num: 'Emergencias · marca 911', say: 'una persona necesita ayuda por la inundación', extra: null, guide: null },
  otro: { n: 'Otro problema por la lluvia', who: 'Protección Civil', call: 'Llamar a Protección Civil', num: 'Protección Civil · marca 911', say: 'necesito ayuda por la lluvia', extra: null, guide: null },
}

// Acepta alias del equipo/otros módulos y cae en 'otro' si no lo conoce.
const ALIAS = { herida: 'persona_herida', persona: 'persona_herida', carro: 'coche', arbol: 'arbol_caido', luz: 'riesgo_electrico', electrico: 'riesgo_electrico' }
export function normalizarCaso(c) {
  const k = String(c || '').toLowerCase()
  if (ALIAS[k]) return ALIAS[k]
  return CASOS[k] ? k : 'otro'
}

// "Qué decir al llamar" (texto del equipo).
export function mensajeLlamada({ say, lugar, personas = 1 }) {
  const frase = say ? say[0].toUpperCase() + say.slice(1) : 'Necesito ayuda'
  const n = Math.max(1, personas | 0)
  return [lugar ? `Estoy en ${lugar}.` : null, `${frase}.`, `Somos ${n} ${n === 1 ? 'persona' : 'personas'}.`].filter(Boolean).join(' ')
}
export const urlUbicacion = (lat, lng) => `https://www.google.com/maps?q=${(+lat).toFixed(5)},${(+lng).toFixed(5)}`
export const mensajeUbicacion = (texto, lat, lng) => `${texto} Mi ubicación: ${urlUbicacion(lat, lng)}`

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

// ---------------------------------------------------------------- Alertas de clima (ronda 2, Equipo 5)
// Nivel del backend (bajo|medio|alto) → "Nivel N de 3 (palabra)" como lo validó el Equipo 5 (nunca solo color).
const NIVELES = { bajo: [1, 'ligera'], medio: [2, 'moderada'], alto: [3, 'intensa'] }
export function nivelAlerta(n) {
  const [num, palabra] = NIVELES[n] || NIVELES.bajo
  return { clave: NIVELES[n] ? n : 'bajo', num, palabra, texto: `Nivel ${num} de 3 (${palabra})` }
}

// "hace 5 min" a partir de una fecha ISO. null si no hay fecha válida.
export function textoHace(iso, ahora = Date.now()) {
  const t = iso ? new Date(iso).getTime() : NaN
  if (Number.isNaN(t)) return null
  const min = Math.max(0, Math.round((ahora - t) / 60000))
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return `hace ${d} día${d === 1 ? '' : 's'}`
}

const hora = (d) => d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
// Vigencia legible: "Hasta 9:00 p.m." / "De 4:00 p.m. a 9:00 p.m." (fechas ISO del backend).
export function textoVigencia(desde, hasta) {
  const a = desde ? new Date(desde) : null, b = hasta ? new Date(hasta) : null
  const ok = (d) => d && !Number.isNaN(d.getTime())
  if (ok(a) && ok(b)) return `De ${hora(a)} a ${hora(b)}`
  if (ok(b)) return `Hasta ${hora(b)}`
  return null
}

// Texto para compartir: solo lo que dijo la fuente + enlace a la app.
export function mensajeAlerta(a, enlace) {
  const n = nivelAlerta(a?.nivel)
  const vig = textoVigencia(a?.vigente_desde, a?.vigente_hasta)
  return [
    `¡Aguas! ${a?.titulo || 'Alerta de clima'}${a?.municipio ? ` en ${a.municipio}` : ''} (nivel ${n.num} de 3, ${n.palabra}).`,
    vig ? `Pronóstico: ${vig.charAt(0).toLowerCase() + vig.slice(1)}.` : null,
    a?.fuente ? `Fuente: ${a.fuente}.` : null,
    enlace || null,
  ].filter(Boolean).join(' ')
}
export const urlWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`
export const urlSms = (texto) => `sms:?&body=${encodeURIComponent(texto)}`

// Preferencias de avisos del Equipo 5: siempre en este celular y, si hay suscripción push, en `preferencias_push`.
export const PREFS_AVISOS_BASE = { soloCambios: true, soloFuertes: false, silencioHasta: null }
export const DOS_HORAS_MS = 2 * 60 * 60 * 1000
export const silenciado = (p, ahora = Date.now()) => !!(p?.silencioHasta && p.silencioHasta > ahora)

// Argumentos de `preferenciasPush` a partir de las preferencias locales (silencio = minutos que faltan; 0 = sin silencio).
export function argsPreferencias(p, ahora = Date.now()) {
  const resta = silenciado(p, ahora) ? Math.ceil((p.silencioHasta - ahora) / 60000) : 0
  return { soloCambios: !!p?.soloCambios, soloFuertes: !!p?.soloFuertes, silenciarMin: resta }
}

// ---------------------------------------------------------------- Calles / ¿Puedo pasar? (ronda 3, Equipo 5)
// medio del store → vista del equipo: Manejo / Camino / Camión.
const GRUPO = { auto: 'manejo', moto: 'manejo', peaton: 'camino', bici: 'camino', transporte_publico: 'camion' }
export const grupoMedio = (m) => GRUPO[m] || 'camino'
export const MEDIO_DE_GRUPO = { manejo: 'auto', camino: 'peaton', camion: 'transporte_publico' }
export const GRUPOS = [['manejo', 'Manejo', 'auto'], ['camino', 'Camino', 'peaton'], ['camion', 'Camión', 'transporte_publico']]

const PEOR_NIVEL = ['bajo', 'medio', 'alto', 'critico']
export const NIVEL_TXT = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto', critico: 'Crítico' }
export const claseNivel = (n) => (n === 'critico' ? 'ay-p-critico' : `p-${PEOR_NIVEL.includes(n) ? n : 'bajo'}`)

// crítico/alto/bloqueado → no · medio/limitado → precaución · bajo/sin_riesgo → sí (con cuidado). Gana lo peor.
export function puedoPasar({ nivel, gravedad } = {}) {
  if (nivel === 'critico' || nivel === 'alto' || gravedad === 'bloqueado') return 'no'
  if (nivel === 'medio' || gravedad === 'limitado') return 'precaucion'
  return 'si'
}
export const VEREDICTO = {
  no: { texto: 'No pases', etiqueta: 'Inundado', icono: 'cerrar' },
  precaucion: { texto: 'Con precaución', etiqueta: 'Con agua', icono: 'alerta' },
  si: { texto: 'Puedes pasar con cuidado', etiqueta: 'Con poca agua', icono: 'check' },
}
// Mensaje por vista (copy del equipo; sin afirmar datos que no tenemos: profundidad, desvíos reales).
export const MENSAJE_VIA = {
  no: { manejo: 'Cerrado. No intentar pasar.', camino: 'No cruces caminando.', camion: 'Espera retrasos o desvíos en tu ruta.' },
  precaucion: { manejo: 'Solo autos altos y con precaución.', camino: 'Banquetas con agua. Mejor espera o usa otra calle.', camion: 'Servicio lento, con posibles retrasos.' },
  si: { manejo: 'Transitable con cuidado.', camino: 'Puedes caminar con cuidado.', camion: 'Servicio con posibles retrasos menores.' },
}
// Tabla "¿Puedo pasar?" del equipo: Auto bajo · Camioneta o auto alto · A pie.
export const PASO_VEHICULO = {
  no: { bajo: false, alto: false, pie: false },
  precaucion: { bajo: false, alto: true, pie: false },
  si: { bajo: true, alto: true, pie: true },
}

const peorGravedad = (a, b) => {
  const o = ['sin_riesgo', 'limitado', 'bloqueado']
  return o.indexOf(a) >= o.indexOf(b) ? a : b
}
const gravedadDe = (r) => r?.gravedad || (r?.pasan_carros === false ? 'bloqueado' : null)

// Vías cercanas: zonas públicas a ≤ radio (las enriquece la gravedad de reportes activos a ≤ 250 m).
// Si no hay zonas, usa los reportes activos (sin persona_en_riesgo) como filas.
export function viasCercanas({ zonas = [], reportes = [], ubic, radio = 3000, max = 5 }) {
  const activos = (reportes || []).filter((r) => r.estado === 'activo' && r.tipo !== 'persona_en_riesgo')
  let filas = (zonas || []).map((z) => {
    let g = z.alguno_no_pasan_carros ? 'bloqueado' : null
    for (const r of activos) if (distanciaM(z, r) <= 250 && gravedadDe(r)) g = g ? peorGravedad(g, gravedadDe(r)) : gravedadDe(r)
    return { id: 'z' + z.celda, lat: z.lat, lng: z.lng, nivel: z.nivel, gravedad: g, reportes: z.total_reportes || 0, act: z.actualizado_en }
  })
  if (!filas.length) {
    filas = activos.map((r) => ({ id: 'r' + r.id, lat: r.lat, lng: r.lng, nivel: r.nivel || 'bajo', gravedad: gravedadDe(r), reportes: 1, act: r.ultima_confirmacion || r.creado_en }))
  }
  return filas
    .map((f) => ({ ...f, dist: distanciaM(ubic, f), veredicto: puedoPasar(f) }))
    .filter((f) => f.dist != null && f.dist <= radio)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, max)
}

// Ruta alterna: Google Maps desde tu ubicación con el modo de tu vista (tú eliges el destino; Maps da alternativas).
const MODO_MAPS = { manejo: 'driving', camino: 'walking', camion: 'transit' }
export const urlRutaAlterna = (ubic, grupo) =>
  `https://www.google.com/maps/dir/?api=1&origin=${ubic.lat},${ubic.lng}&travelmode=${MODO_MAPS[grupo] || 'driving'}`
