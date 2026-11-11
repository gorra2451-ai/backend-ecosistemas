// MÓDULO D · Confirmación (Equipo 4). Lógica pura del aviso "¿Sigue inundado?" + envoltura de las RPC.
// Contrato v2: confirmar_reporte(p_reporte_id, p_sigue) · marcar_falso(p_reporte_id) · reportes_cercanos ·
// mis_reportes. Códigos: sin_sesion, reporte_no_existe, propio_reporte, reporte_no_activo, parametros_invalidos.
// (No existe `ya_confirmado`: votar otra vez actualiza el voto anterior → "mantuvimos tu voto".)
// Privacidad (AGENTS §8): la posición de quien viaja vive solo en memoria mientras la app está abierta.
// Aquí solo se guardan ids de reportes (preguntados, votos, estado de mis reportes), nunca coordenadas.
import { asegurarSesion, confirmarReporte, marcarFalso } from './api.js'
import { distanciaM } from './mapa.js'

// ---- Constantes del equipo (editables) ----
export const RADIO_ALERTA_M = 400     // alerta previa al acercarse a una zona activa
export const RADIO_LLEGADA_M = 150    // "llegada a la zona" → se pregunta si sigue inundado
export const CADA_MS = 60_000         // consulta de reportes cercanos
export const CADA_MIO_MS = 60_000     // sondeo de "Mi reporte"
export const CIERRE_PASIVO_MS = 20_000 // aviso de solo lectura/voz (vehículo en movimiento) se oculta solo
export const MIN_ATENUAR = 60         // min sin confirmaciones para atenuarse ("Antiguo"), del equipo
export const VEL_MOVIMIENTO_MS = 4    // > 4 m/s (≈14 km/h) = vehículo en movimiento
export const RADIO_CERCANOS_M = RADIO_ALERTA_M
const CLAVE = 'aguas.confirm.preguntados'
const CLAVE_ALERTAS = 'aguas.confirm.alertados'
const CLAVE_VOTOS = 'aguas.confirm.votos'
const CLAVE_MIOS = 'aguas.confirm.mios'

// ---- Medio de transporte (registro: peaton|bici|moto|auto|transporte_publico) ----
export const esVehiculo = (medio) => medio === 'auto' || medio === 'moto'
export const gente = (medio) => (esVehiculo(medio) ? 'otros conductores' : 'otras personas')
const MODO_MAPS = { auto: 'driving', moto: 'two-wheeler', bici: 'bicycling', peaton: 'walking', transporte_publico: 'transit' }
// "Desviar ruta": no hay ruteo propio; Google Maps recalcula con su tráfico. No acepta "evitar este punto".
export const urlDesviar = (medio) => `https://www.google.com/maps/dir/?api=1&travelmode=${MODO_MAPS[medio] || 'driving'}`

// Velocidad en m/s: la del GPS si viene; si no, con el punto anterior (solo en memoria, se descarta).
export function velocidadDe(pos, prev) {
  const s = pos?.coords?.speed
  if (Number.isFinite(s) && s >= 0) return s
  if (!prev || !pos?.coords) return null
  const dt = (pos.timestamp - prev.t) / 1000
  if (!(dt > 0)) return null
  return distanciaM(prev, { lat: pos.coords.latitude, lng: pos.coords.longitude }) / dt
}
export function enMovimiento(vel, antes = false) {
  if (!Number.isFinite(vel)) return antes
  return vel > VEL_MOVIMIENTO_MS
}

// ---- Estado del viaje (store pequeño sin React; lo escribe el detector, lo lee el aviso) ----
let viaje = { moviendo: false, vel: null, pendiente: null }
const oyentes = new Set()
export const leerViaje = () => viaje
export function cambiarViaje(cambio) { viaje = { ...viaje, ...cambio }; oyentes.forEach((f) => f()) }
export function suscribirViaje(f) { oyentes.add(f); return () => oyentes.delete(f) }
export const puedeTocar = (medio, v = viaje) => !(esVehiculo(medio) && v.moviendo)

// ---- Elegir reporte ----
// Demo y compatibilidad: el más cercano que no es mío y que no se preguntó en esta sesión.
export function elegirCercano(lista, preguntados = []) {
  const ya = new Set(preguntados)
  const candidatos = (lista || []).filter((r) => r && r.es_propio === false && !ya.has(r.id))
  if (!candidatos.length) return null
  return candidatos.reduce((a, b) => ((b.distancia_m ?? Infinity) < (a.distancia_m ?? Infinity) ? b : a))
}

// Con la posición actual: { llegada } a ≤ RADIO_LLEGADA_M (cualquier estado, para confirmarlo) y
// { alerta } de una zona ACTIVA a ≤ RADIO_ALERTA_M que todavía no está a la vista.
export function clasificarCercanos(lista, punto, { preguntados = [], alertados = [] } = {}) {
  const pr = new Set(preguntados); const al = new Set(alertados)
  const filas = (lista || []).filter((r) => r && r.es_propio === false)
    .map((r) => ({ ...r, distancia_m: punto ? distanciaM(punto, r) : r.distancia_m }))
    .filter((r) => Number.isFinite(r.distancia_m))
    .sort((a, b) => a.distancia_m - b.distancia_m)
  const llegada = filas.find((r) => r.distancia_m <= RADIO_LLEGADA_M && !pr.has(r.id)) || null
  const alerta = filas.find((r) => r.estado === 'activo' && r.distancia_m > RADIO_LLEGADA_M &&
    r.distancia_m <= RADIO_ALERTA_M && !al.has(r.id) && !pr.has(r.id)) || null
  return { llegada, alerta }
}

// ¿Puede el detector abrir el aviso ahora?
export function puedePreguntar({ ubic, screen, overlay }) {
  return !!ubic?.real && !screen && !overlay
}

// ---- Textos ----
// Formato del equipo: "hace 4 min" · "hace 1 h 20 min" · "hace 2 h".
export function haceMin(ts, ahora = Date.now()) {
  if (!ts) return null
  const min = Math.max(0, Math.round((ahora - new Date(ts).getTime()) / 60000))
  if (!Number.isFinite(min)) return null
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60); const r = min % 60
  return r ? `hace ${h} h ${r} min` : `hace ${h} h`
}

export const fechaRef = (rep) => rep?.ultima_confirmacion || rep?.creado_en || null
export function esAntiguo(rep, ahora = Date.now()) {
  const t = Date.parse(fechaRef(rep))
  return Number.isFinite(t) && (ahora - t) / 60000 > MIN_ATENUAR
}

export const personas = (n) => `${n} ${n === 1 ? 'persona' : 'personas'}`

// Insignia del equipo: "Confirmado por N personas • hace X" (atenuada como "Antiguo" tras MIN_ATENUAR).
export function insignia(rep, ahora = Date.now()) {
  const h = haceMin(fechaRef(rep), ahora)
  const n = rep?.confirmaciones_si
  const base = !Number.isFinite(n) ? 'Reportado' : n === 0 ? 'Esperando confirmaciones' : `Confirmado por ${personas(n)}`
  const texto = [base, h].filter(Boolean).join(' • ')
  const antiguo = esAntiguo(rep, ahora)
  return { antiguo, texto: antiguo ? `Antiguo · ${texto}` : texto }
}

// Nivel (bajo 5–9 · medio 10–14 · alto 15–19 · crítico ≥ 20) → palabra + estado (equipo).
const NIVELES = {
  bajo: { nombre: 'Riesgo bajo', estado: 'Transitable con precaución' },
  medio: { nombre: 'Riesgo medio', estado: 'Transitable con precaución' },
  alto: { nombre: 'Riesgo alto', estado: 'Cerrado' },
  critico: { nombre: 'Riesgo crítico', estado: 'Cerrado' },
}
export const nivelRiesgo = (nivel) => NIVELES[nivel] || null

const QUE = { calle: 'una calle inundada', casa: 'una casa inundada', coche: 'un coche en el agua', persona_en_riesgo: 'una persona en riesgo' }
const TIPO = { calle: 'Calle inundada', casa: 'Casa inundada', coche: 'Coche en el agua', persona_en_riesgo: 'Persona en riesgo' }
export const tipoDe = (rep) => TIPO[rep?.tipo] || 'Inundación'

// Respaldo si aún no llega la dirección de Nominatim: "una calle inundada a 40 m".
export function lugarDe(rep) {
  const que = QUE[rep?.tipo] || 'un reporte de inundación'
  const d = Number.isFinite(rep?.distancia_m) ? ` a ${Math.round(rep.distancia_m)} m` : ''
  return que + d
}

export function horaDe(ts) {
  const t = Date.parse(ts)
  if (!Number.isFinite(t)) return null
  return new Date(t).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
}

// "A 350 m · llegas en ~1 min" (si hay velocidad).
export function textoLlegas(dist, vel) {
  const d = Number.isFinite(dist) ? `A ${Math.max(10, Math.round(dist / 10) * 10)} m` : 'Cerca de ti'
  if (!Number.isFinite(vel) || vel < 0.5) return d
  const min = Math.max(1, Math.round(dist / vel / 60))
  return `${d} · llegas en ~${min} min`
}

const MSG = {
  propio: 'Ese reporte es tuyo: no puedes confirmarlo.',
  propio_reporte: 'Ese reporte es tuyo: no puedes confirmarlo.',
  reporte_no_activo: 'Ese reporte ya se cerró. Gracias de todos modos.',
  reporte_no_existe: 'Ese reporte ya no existe.',
  sin_sesion: 'Se cerró tu sesión. Vuelve a intentar.',
  sin_red: 'No hay señal. Intenta de nuevo cuando vuelva.',
  parametros_invalidos: 'No pudimos enviar tu respuesta. Vuelve a intentar.',
}
export function mensajeConfirmar(codigo) {
  return MSG[codigo] || 'No pudimos enviar tu respuesta. Vuelve a intentar.'
}

// ---- Respuestas ----
// accion: 'sigue' (Sí) | 'bajo' (Ya se secó / El agua bajó) | 'nunca' (Calle seca / Nunca hubo agua)
export const votoDe = (accion) => (accion === 'sigue' ? 'si' : 'no')
// Nunca lanza: si la sesión o la red fallan, devuelve { error: 'desconocido' } (el botón no se queda en "Enviando…").
export async function responder(id, accion) {
  try {
    await asegurarSesion()
    if (accion === 'nunca') return await marcarFalso(id)
    return await confirmarReporte(id, accion === 'sigue')
  } catch {
    return { data: null, error: 'desconocido' }
  }
}

// Copy del "¡Gracias!" del equipo, sin el "ayudó a N" (N no existe en el backend, P-29).
export function textoGracias(accion, medio) {
  return votoDe(accion) === 'si'
    ? `Tu aviso ayuda a ${gente(medio)} a evitar la inundación.`
    : `Tu aviso ayuda a ${gente(medio)} a no desviarse sin necesidad.`
}
// Líneas extra de la pantalla final según lo que devolvió el backend.
// antes = estado del reporte al preguntar; pendiente → activo significa que este "sí" lo publicó.
export function notasGracias({ repetido, estado, antes }) {
  const n = []
  if (antes === 'pendiente' && estado === 'activo') n.push('Con tu confirmación ya aparece en el mapa.')
  if (repetido) n.push('Ya habías respondido este reporte; mantuvimos tu voto.')
  if (estado === 'resuelto' || estado === 'oculto') n.push('Con tu respuesta, este reporte ya no aparece en el mapa.')
  if (estado === 'en_revision') n.push('Lo vamos a revisar.')
  return n
}

// ---- Almacenamiento (solo ids) ----
let memoria = {}
function leerJSON(store, clave, defecto) {
  try { const v = store().getItem(clave); return v ? JSON.parse(v) : (memoria[clave] ?? defecto) } catch { return memoria[clave] ?? defecto }
}
function guardarJSON(store, clave, v) {
  memoria[clave] = v
  try { store().setItem(clave, JSON.stringify(v)) } catch { /* sin storage */ }
}
const ses = () => sessionStorage
const loc = () => localStorage

export const leerPreguntados = () => leerJSON(ses, CLAVE, [])
export function marcarPreguntado(id) { guardarJSON(ses, CLAVE, [...new Set([...leerPreguntados(), id])].slice(-200)) }
export const leerAlertados = () => leerJSON(ses, CLAVE_ALERTAS, [])
export function marcarAlertado(id) { guardarJSON(ses, CLAVE_ALERTAS, [...new Set([...leerAlertados(), id])].slice(-200)) }

// Un ID anónimo = un voto por reporte (se puede cambiar). Devuelve true si repitió el mismo voto.
export const leerVotos = () => leerJSON(loc, CLAVE_VOTOS, {})
export function registrarVoto(id, accion) {
  const votos = leerVotos(); const v = votoDe(accion)
  const repetido = votos[id] === v
  const sig = { ...votos, [id]: v }
  const ids = Object.keys(sig); if (ids.length > 200) delete sig[ids[0]]
  guardarJSON(loc, CLAVE_VOTOS, sig)
  return repetido
}

// ---- "Mi reporte": avisar SOLO cuando cambia el estado visible ----
export function estadoVisible(rep) {
  if (rep?.estado === 'activo') return 'confirmado'
  if (rep?.estado === 'resuelto') return 'resuelto'
  return 'oculto' // pendiente, en_revision, oculto: no está en el mapa
}
// previos = { id: estadoVisible } | null (primera vez: solo línea base, sin avisos).
export function cambiosMios(lista, previos) {
  const estados = {}; const avisos = []
  for (const r of lista || []) {
    if (!r?.id) continue
    const nuevo = estadoVisible(r)
    estados[r.id] = nuevo
    const antes = previos?.[r.id]
    if (!previos || antes === undefined || antes === nuevo) continue
    if (nuevo === 'confirmado') avisos.push({ rep: r, txt: `Tu reporte fue confirmado por ${personas(r.confirmaciones_si ?? 0)}` })
    if (nuevo === 'resuelto') avisos.push({ rep: r, txt: 'Tu reporte se resolvió' })
  }
  return { estados, avisos }
}
export const leerMios = () => leerJSON(loc, CLAVE_MIOS, null)
export const guardarMios = (e) => guardarJSON(loc, CLAVE_MIOS, e)

// ---- Señal de alerta (sonido / vibración / voz) según preferencias ----
export function permiteSenal(prefs = {}, ahora = Date.now()) {
  const h = prefs.silencioHasta
  const t = typeof h === 'number' ? h : Date.parse(h)
  const silenciado = Number.isFinite(t) && t > ahora
  return { sonido: !silenciado, vibra: !silenciado && prefs.vibra !== false } // D-027: activada salvo que se apague
}
export function senal(prefs) {
  const p = permiteSenal(prefs)
  if (p.vibra) { try { navigator.vibrate?.([120, 80, 120]) } catch { /* nada */ } }
  if (!p.sonido) return
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC(); const o = ctx.createOscillator(); const g = ctx.createGain()
    o.frequency.value = 880; g.gain.value = 0.08
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.25)
    o.onended = () => ctx.close()
  } catch { /* sin audio */ }
}
// Lee en voz alta (es-MX). cb() al terminar (o de inmediato si no hay síntesis).
export function hablar(texto, cb = () => {}) {
  try {
    if (!('speechSynthesis' in window)) { cb(); return }
    const s = window.speechSynthesis
    const u = new SpeechSynthesisUtterance(texto)
    u.lang = 'es-MX'; u.onend = () => cb(); u.onerror = () => cb()
    const voz = s.getVoices?.().find((v) => /^es[-_]MX/i.test(v.lang)) || s.getVoices?.().find((v) => /^es/i.test(v.lang))
    if (voz) u.voice = voz
    // Safari iOS se queda callado si se llama cancel() y speak() seguidos sin que haya algo sonando.
    if (s.speaking || s.pending) s.cancel()
    s.resume?.()
    s.speak(u)
  } catch { cb() }
}

// ---- Voz ----
// "desviar (ruta)" → 'desviar'; "sí"/"sigue" → 'sigue'; "ya no"/"no"/"bajó"/"seco" → 'ya_no'; lo demás → null.
// "Nunca hubo agua" (marcar falso) no se acepta por voz: evita marcar reportes por error.
export function interpretarVoz(texto) {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ')
  const p = ` ${t.replace(/\s+/g, ' ').trim()} `
  if (/ desvia(r|me|la)? /.test(p)) return 'desviar'
  if (/ no se /.test(p)) return null // "no sé"
  if (/ (ya no|no|nel|bajo|seco|seca) /.test(p)) return 'ya_no'
  if (/ (si|sigue|sip|claro|aja) /.test(p)) return 'sigue'
  return null
}

export function claseVoz(w = typeof window !== 'undefined' ? window : undefined) {
  return w ? (w.SpeechRecognition || w.webkitSpeechRecognition || null) : null
}

// Escucha una frase en es-MX. Devuelve una función para cancelar. cb(accion|null).
export function escucharVoz(cb, Clase = claseVoz()) {
  if (!Clase) { cb(null); return () => {} }
  let listo = false
  const fin = (v) => { if (!listo) { listo = true; cb(v) } }
  let rec
  try {
    rec = new Clase()
    rec.lang = 'es-MX'
    rec.interimResults = false
    rec.maxAlternatives = 3
    rec.onresult = (e) => {
      const alts = Array.from(e.results?.[0] || []).map((a) => a.transcript)
      fin(alts.map(interpretarVoz).find(Boolean) || null)
    }
    rec.onerror = () => fin(null)
    rec.onend = () => fin(null)
    rec.start()
  } catch { fin(null) }
  return () => { listo = true; try { rec?.abort() } catch { /* nada */ } }
}
