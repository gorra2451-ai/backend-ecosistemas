// MÓDULO B · Reportar. Lógica pura (probada en reportar.test.js) + llamadas propias del módulo.
// No toca api.js: lo que falta aquí se arma con `supabase` y `codigoError`.
import { supabase } from './supabase.js'
import { codigoError } from './api.js'

// ---------- Tipos y etiquetas (HTML validado del Equipo Reporte, ronda 3) ----------
export const TIPO_LABEL = { casa: 'Casa', coche: 'Coche', calle: 'Calle', persona_en_riesgo: 'Persona en riesgo' } // tarjetas
export const TIPO_LARGO = { casa: 'Casa inundada', coche: 'Coche atrapado', calle: 'Calle inundada', persona_en_riesgo: 'Persona en riesgo' }
export const TIPOS_REPORTE = ['casa', 'coche', 'calle', 'persona_en_riesgo'] // orden de las tarjetas del equipo

// "¿Cuánta agua hay?" (Bajo · Medio · Alto) → gravedad del contrato v2 (gravedad_reporte). Para TODOS los tipos.
// Mapeo propio (el equipo no usa los nombres del contrato): Bajo → sin_riesgo · Medio → limitado · Alto → bloqueado.
export const GRAVEDAD = [
  { k: 'sin_riesgo', nivel: 'bajo', t: 'Bajo', d: 'Hay agua, se puede pasar con cuidado.', pasanCarros: true },
  { k: 'limitado', nivel: 'medio', t: 'Medio', d: 'Agua a media llanta o a la rodilla. Mejor esperar.', pasanCarros: true },
  { k: 'bloqueado', nivel: 'alto', t: 'Alto', d: 'No pasan carros. No cruzar.', pasanCarros: false },
]
export const GRAVEDAD_CALLE = GRAVEDAD // alias de la ronda 2
export const pasanCarrosDeGravedad = (k) => GRAVEDAD.find((g) => g.k === k)?.pasanCarros ?? true
export const gravedadInfo = (k) => GRAVEDAD.find((g) => g.k === k) || null

export const DETALLE_LABEL = {
  si: 'Pasan carros', no: 'No pasan carros', // ronda 1 (se conservan para reportes ya guardados)
  bloqueado: 'Nivel alto', limitado: 'Nivel medio', sin_riesgo: 'Nivel bajo',
  tobillo: 'Agua a los tobillos', rodilla: 'Agua a las rodillas', cintura: 'Agua a la cintura o más', // ronda 1
  vacio: 'Coche sin nadie dentro', dentro: 'Hay alguien dentro de un coche',
}
export const etiquetaReporte = (rep) =>
  [TIPO_LARGO[rep?.tipo] || 'Reporte', DETALLE_LABEL[rep?.gravedad || rep?.detalle]].filter(Boolean).join(' · ')

// Sin gravedad el backend v1 exige p_pasan_carros no nulo: se manda `true` (neutro).
export function pasanCarrosPara(tipo, respuesta) {
  if (tipo === 'calle') return respuesta === true
  return true
}

// Stepper del flujo: Tipo · Detalles · Evidencia · Enviado. k: done | now | next.
export const PASOS_REPORTE = ['Tipo', 'Detalles', 'Evidencia', 'Enviado']
export const pasosStepper = (actual) =>
  PASOS_REPORTE.map((label, i) => ({ label, k: i < actual || actual === PASOS_REPORTE.length - 1 && i === actual ? 'done' : i === actual ? 'now' : 'next' }))

// Precisión (m) que se manda cuando la persona elige el punto en la búsqueda en vez del GPS.
export const PRECISION_LUGAR_BUSCADO = 50

// Texto de ubicación: dirección real (Nominatim) o, si no hay, la precisión del GPS.
export const textoUbicacion = (direccion, precision) =>
  direccion || (precision ? `Tu ubicación actual ±${Math.round(precision)} m` : 'Tu ubicación actual')

// Resumen "Tu reporte": tipo, nivel (con patrón), ubicación, foto. `patron` = clase p-bajo|p-medio|p-alto.
const ICONO_TIPO = { calle: 'calle', casa: 'casa', coche: 'coche', persona_en_riesgo: 'riesgo' }
const PATRON = { bajo: 'p-bajo', medio: 'p-medio', alto: 'p-alto', critico: 'p-alto' }
export const iconoTipo = (tipo) => ICONO_TIPO[tipo] || 'alerta'
export function resumenReporte(rep) {
  if (!rep) return []
  const g = gravedadInfo(rep.gravedad || rep.detalle)
  return [
    { icono: iconoTipo(rep.tipo), texto: TIPO_LARGO[rep.tipo] || 'Reporte' },
    g && { icono: 'barras', texto: g.t, patron: PATRON[g.nivel] },
    { icono: 'pin', texto: textoUbicacion(rep.direccion, rep.precision) },
    { icono: 'imagen', texto: rep.evidenciaFallo ? 'La foto o video no se subió' : rep.archivo || (rep.evidencia ? 'Con evidencia' : 'Sin foto') },
  ].filter(Boolean)
}

// Arma lo que se manda al backend y lo que se guarda en "mis reportes" (local).
// `ubic` puede ser el GPS o un lugar elegido en la búsqueda ({ lat, lng, precision }).
export function armarReporte({ tipo, gravedad = null, detalle = null, pasanCarros, ubic, direccion = null, id = crypto.randomUUID(), ahora = Date.now() }) {
  const payload = {
    id, tipo, pasanCarros: gravedad ? pasanCarrosDeGravedad(gravedad) : pasanCarrosPara(tipo, pasanCarros),
    lat: ubic.lat, lng: ubic.lng, precision: ubic.precision,
  }
  if (gravedad) payload.gravedad = gravedad
  const rep = { id, tipo, detalle: gravedad || detalle, lat: ubic.lat, lng: ubic.lng, precision: ubic.precision, creado: ahora }
  if (gravedad) rep.gravedad = gravedad
  if (direccion) rep.direccion = direccion
  return { payload, rep }
}

// Título de la tarjeta de ubicación en Detalles.
export const tituloUbicacion = ({ elegido, real }) => (elegido ? 'Ubicación elegida' : real ? 'Ubicación detectada' : 'Sin ubicación')

// Candado para acciones async: mientras una corre, las llamadas extra no hacen nada (doble toque en "Enviar").
export function crearCandado() {
  let ocupado = false
  return async (tarea) => {
    if (ocupado) return undefined
    ocupado = true
    try { return await tarea() } finally { ocupado = false }
  }
}

// Caso de "¿A quién acudo?" según el tipo reportado (solo casa y coche ofrecen el atajo).
export const casoAcudo = (tipo) => (tipo === 'casa' || tipo === 'coche' ? tipo : null)

// ---------- Estado → chip y línea de tiempo ----------
export function chipEstado(estado) {
  if (estado === 'cola') return { clase: 'chip-cola', texto: 'En cola · sin señal' }
  if (estado === 'activo') return { clase: 'chip-act', texto: 'Activo' }
  if (estado === 'resuelto') return { clase: 'chip-res', texto: 'Resuelto' }
  if (estado === 'no_enviado') return { clase: 'chip-cola', texto: 'No se envió' }
  if (estado === 'en_revision') return { clase: 'chip-pend', texto: 'En revisión' }
  return { clase: 'chip-pend', texto: 'Pendiente' }
}

export function mensajeEnviado(estado) {
  if (estado === 'cola') return 'No hay señal. Tu reporte se guardó y se envía solo cuando vuelva. No tienes que hacer nada.'
  return 'Tu reporte ya está en el mapa. Te avisamos cuando lo confirmen.'
}
// Línea de estado bajo el título (honesta: pendiente = sin confirmar).
export function estadoEnviado(estado) {
  if (estado === 'cola') return 'En cola · se envía al volver la señal'
  if (estado === 'activo') return 'Publicado · visible para todos'
  return 'Sin confirmar · esperando a otros vecinos'
}

// Pasos: Enviado → Pendiente → Activo → Resuelto. k: done | now | next.
export function lineaDeTiempo(estado, creado) {
  const orden = { cola: 0, pendiente: 1, en_revision: 1, activo: 2, resuelto: 3, oculto: 3 }
  const i = orden[estado] ?? 1
  const k = (paso) => (paso < i ? 'done' : paso === i ? (paso === 3 ? 'done' : 'now') : 'next')
  return [
    { label: 'Enviado', desc: estado === 'cola' ? 'En cola: se envía cuando vuelva la señal' : horaCorta(creado), k: i === 0 ? 'now' : 'done' },
    { label: estado === 'en_revision' ? 'En revisión' : 'Pendiente', desc: estado === 'en_revision' ? 'Lo está revisando el equipo' : `Esperando ${CONFIRMACIONES_PARA_PUBLICAR} confirmaciones de otros vecinos`, k: k(1) },
    { label: 'Activo', desc: 'Ya es zona en el mapa', k: k(2) },
    { label: 'Resuelto', desc: 'Cuando dejen de confirmarlo o digan “ya no”', k: k(3) },
  ]
}

// ---------- Mis reportes (contrato v2 · mis_reportes) ----------
// Valor por defecto de parametros.confirmaciones_para_publicar (solo para el texto; el backend decide).
export const CONFIRMACIONES_PARA_PUBLICAR = 5
const NIVEL_LABEL = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto', critico: 'Crítico' }

// Fila del servidor → misma forma que el registro local (creado en ms, detalle = gravedad).
export function normalizarMiReporte(x) {
  return {
    id: x.id, tipo: x.tipo, gravedad: x.gravedad || null, detalle: x.gravedad || null, estado: x.estado || 'pendiente',
    lat: x.lat, lng: x.lng, creado: x.creado_en ? new Date(x.creado_en).getTime() : null,
    confirmacionesSi: x.confirmaciones_si ?? null, nivel: x.nivel || null, ultima: x.ultima_confirmacion || null,
    deServidor: true,
  }
}

// Une servidor + local: el servidor manda en estado y conteos; lo local aporta dirección/evidencia y lo que el
// servidor no tiene (en cola, no enviado). Más recientes primero, máx. 20.
export function unirMisReportes(servidor, local = []) {
  const loc = new Map(local.map((r) => [r.id, r]))
  const s = (servidor || []).map((x) => { const n = normalizarMiReporte(x); const l = loc.get(n.id); return l ? { ...l, ...n, creado: n.creado ?? l.creado } : n })
  const ids = new Set(s.map((r) => r.id))
  return [...s, ...local.filter((r) => !ids.has(r.id))].sort((a, b) => (b.creado || 0) - (a.creado || 0)).slice(0, 20)
}

// Texto de la fila en "Mis reportes".
export function filaMiReporte(r, ahora = Date.now()) {
  const estado = {
    pendiente: `Esperando ${CONFIRMACIONES_PARA_PUBLICAR} confirmaciones`, activo: 'Activo · en el mapa', resuelto: 'Resuelto',
    en_revision: 'En revisión', cola: 'En cola · sin señal', no_enviado: 'No se envió', oculto: 'Retirado',
  }[r.estado] || 'Pendiente'
  const n = r.confirmacionesSi
  return {
    titulo: TIPO_LARGO[r.tipo] || 'Reporte',
    estado,
    confirmaciones: n == null ? null : `${n} ${n === 1 ? 'confirmación' : 'confirmaciones'} “sí”`,
    nivel: r.nivel && NIVEL_LABEL[r.nivel] ? { texto: `Nivel ${NIVEL_LABEL[r.nivel].toLowerCase()}`, patron: PATRON[r.nivel] } : null,
    hace: r.creado ? haceCuanto(new Date(r.creado).toISOString(), ahora) : '—',
  }
}

// Fila "Cerca de ti" para reportes de otros (reportes_cercanos v2).
export function filaCercano(x, ahora = Date.now()) {
  const g = gravedadInfo(x.gravedad)
  const n = NIVEL_LABEL[x.nivel]
  return {
    titulo: TIPO_LARGO[x.tipo] || 'Inundación',
    lugar: x.distancia_m != null ? `A ${Math.round(x.distancia_m)} m de ti` : '',
    estado: x.estado === 'activo' ? 'Confirmado' : 'Sin confirmar',
    nivel: n ? { texto: n, patron: PATRON[x.nivel] } : g ? { texto: g.t, patron: PATRON[g.nivel] } : null,
    hace: x.ultima_confirmacion || x.creado_en ? `Actualizado ${haceCuanto(x.ultima_confirmacion || x.creado_en, ahora)}` : '',
  }
}

export function horaCorta(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  const hoy = new Date()
  const h = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
  return d.toDateString() === hoy.toDateString() ? `Hoy, ${h}` : `${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}, ${h}`
}

export function haceCuanto(iso, ahora = Date.now()) {
  if (!iso) return '—'
  const min = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  if (min < 48 * 60) return `hace ${Math.round(min / 60)} h`
  return `hace ${Math.round(min / 1440)} días`
}

// ---------- Enlaces para compartir ----------
export const linkMaps = (lat, lng) => `https://www.google.com/maps?q=${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`
export const linkWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`

export function textoFamilia(rep) {
  const que = {
    calle: { no: 'Se inundó la calle, no pasan carros.', bloqueado: 'Se inundó la calle, no se puede pasar.',
      limitado: 'Se inundó la calle, se puede pasar con precaución.' }[rep.detalle] || 'Se inundó la calle.',
    casa: 'Se metió el agua a la casa.',
    coche: 'Un coche quedó en el agua.',
    persona_en_riesgo: 'Hay una persona en riesgo por inundación.',
  }[rep.tipo] || 'Hay una inundación.'
  return `${que} Aquí: ${linkMaps(rep.lat, rep.lng)}`
}
export const textoRiesgo = (lat, lng, enCoche) =>
  `${enCoche ? 'Hay alguien dentro de un coche en el agua.' : 'Hay una persona en riesgo por inundación.'} Es aquí: ${linkMaps(lat, lng)}`

// ---------- Cola sin señal (localStorage `aguas.cola`) ----------
const CLAVE_COLA = 'aguas.cola'
const almacen = () => { try { return globalThis.localStorage || null } catch { return null } }

export function leerCola(st = almacen()) {
  try { const v = st?.getItem(CLAVE_COLA); return v ? JSON.parse(v) : [] } catch { return [] }
}
function escribirCola(lista, st) { try { st?.setItem(CLAVE_COLA, JSON.stringify(lista)) } catch { /* sin storage */ } }

// Mismo id = misma entrada (crear_reporte es idempotente por id: reintentar no duplica).
export function encolar(item, st = almacen()) {
  const lista = [...leerCola(st).filter((x) => x.payload.id !== item.payload.id), item]
  escribirCola(lista, st)
  return lista
}
export function quitarDeCola(id, st = almacen()) {
  const lista = leerCola(st).filter((x) => x.payload.id !== id)
  escribirCola(lista, st)
  return lista
}

// ---------- Foto sin EXIF ----------
// Medidas para que el lado mayor no pase de `max` (no agranda).
export function medidasMax(w, h, max = 1600) {
  if (!w || !h) return { w: 0, h: 0 }
  const f = Math.min(1, max / Math.max(w, h))
  return { w: Math.round(w * f), h: Math.round(h * f) }
}

// Re-dibuja la imagen en un canvas y exporta JPEG 0.85: el archivo nuevo no lleva EXIF (GPS, equipo, hora).
export async function quitarExif(archivo, max = 1600) {
  let fuente
  try {
    fuente = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  } catch {
    fuente = await new Promise((res, rej) => {
      const img = new Image()
      img.onload = () => res(img)
      img.onerror = () => rej(new Error('archivo_invalido'))
      img.src = URL.createObjectURL(archivo)
    })
  }
  const { w, h } = medidasMax(fuente.width, fuente.height, max)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d').drawImage(fuente, 0, 0, w, h)
  fuente.close?.()
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
  if (!blob) throw new Error('archivo_invalido')
  return new File([blob], 'foto.jpg', { type: 'image/jpeg' })
}

// ---------- Llamadas propias del módulo ----------
const r = async (p) => {
  try { const { data, error } = await p; return { data, error: codigoError(error) } } catch (e) { return { data: null, error: codigoError(e) } }
}

// Seguimiento de mi reporte: la lectura pública solo ve reportes ACTIVOS (RLS reportes_lectura_activos).
// Si aparece → activo + confirmaciones; si no aparece, el estado local se queda como está.
export async function seguimientoReporte(id) {
  const rep = await r(supabase.from('reportes').select('id, estado, ultima_confirmacion').eq('id', id).maybeSingle())
  if (rep.error || !rep.data) return { data: null, error: rep.error }
  let confirmaciones = null
  try {
    // anon/authenticated solo leen (reporte_id, sigue, falso) de confirmaciones (endurecimiento_base): `id` da 42501.
    const { count, error } = await supabase.from('confirmaciones').select('reporte_id', { count: 'exact', head: true })
      .eq('reporte_id', id).eq('sigue', true)
    if (!error) confirmaciones = count ?? null
  } catch { /* sin red: se queda en null */ }
  return { data: { estado: rep.data.estado, ultima: rep.data.ultima_confirmacion, confirmaciones }, error: null }
}

// Evidencia: foto o video. El contrato v2 acepta .mov (video/quicktime); api.subirEvidencia lo nombraría ".quicktime".
const EXT_EVIDENCIA = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }
export const extensionEvidencia = (mime) => EXT_EVIDENCIA[mime] || null
export const tipoEvidencia = (mime) => (String(mime).startsWith('video/') ? 'video' : String(mime).startsWith('image/') ? 'foto' : null)

// Refleja parametros.max_evidencia_bytes (y el límite del bucket `evidencias`): 10 MB. Si cambia allá, cambia aquí.
export const MAX_EVIDENCIA_BYTES = 10485760
export const MENSAJE_ARCHIVO = { muy_grande: 'El archivo pesa más de 10 MB. Elige uno más ligero o envía sin foto.' }
// null = sirve; si no, el código del problema (clave de MENSAJE_ARCHIVO).
export const validarArchivo = (archivo) => (archivo?.size > MAX_EVIDENCIA_BYTES ? 'muy_grande' : null)

export async function subirEvidenciaReporte(reporteId, archivo) {
  const ext = extensionEvidencia(archivo.type)
  if (!ext) return { data: null, error: 'tipo_archivo_invalido' }
  const ruta = `${reporteId}/${crypto.randomUUID()}.${ext}`
  const up = await r(supabase.storage.from('evidencias').upload(ruta, archivo, { contentType: archivo.type, upsert: false }))
  if (up.error) return up
  return r(supabase.rpc('agregar_evidencia', { p_reporte_id: reporteId, p_ruta: ruta, p_tipo: tipoEvidencia(archivo.type) }))
}

// Error `sin_sesion`: se tira la sesión local vencida para que crearReporte abra una anónima nueva.
export async function soltarSesion() {
  try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* ya no había */ }
}
