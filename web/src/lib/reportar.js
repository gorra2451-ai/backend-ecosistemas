// MÓDULO B · Reportar. Lógica pura (probada en reportar.test.js) + llamadas propias del módulo.
// No toca api.js: lo que falta aquí se arma con `supabase` y `codigoError`.
import { supabase } from './supabase.js'
import { codigoError } from './api.js'

// ---------- Tipos y etiquetas (copy de App.dc.html) ----------
export const TIPO_LABEL = { calle: 'Calle', casa: 'Mi casa', coche: 'Coche', persona_en_riesgo: 'Persona en riesgo' }
export const DETALLE_LABEL = {
  si: 'Pasan carros', no: 'No pasan carros',
  tobillo: 'Agua a los tobillos', rodilla: 'Agua a las rodillas', cintura: 'Agua a la cintura o más',
  vacio: 'Coche sin nadie dentro', dentro: 'Hay alguien dentro de un coche',
}
export const etiquetaReporte = (rep) =>
  [TIPO_LABEL[rep?.tipo] || 'Reporte', DETALLE_LABEL[rep?.detalle]].filter(Boolean).join(' · ')

// crear_reporte exige p_pasan_carros NO nulo (parametros_invalidos). Solo "La calle" lo pregunta;
// para casa/coche/persona se manda `true` (neutro: no sube la zona a Alto por un dato que nadie dio).
// POR CONFIRMAR con Diego (reportado al integrador).
export function pasanCarrosPara(tipo, respuesta) {
  if (tipo === 'calle') return respuesta === true
  return true
}

// Arma lo que se manda al backend y lo que se guarda en "mis reportes" (local).
export function armarReporte({ tipo, detalle = null, pasanCarros, ubic, id = crypto.randomUUID(), ahora = Date.now() }) {
  const payload = {
    id, tipo, pasanCarros: pasanCarrosPara(tipo, pasanCarros),
    lat: ubic.lat, lng: ubic.lng, precision: ubic.precision,
  }
  const rep = { id, tipo, detalle, lat: ubic.lat, lng: ubic.lng, creado: ahora }
  return { payload, rep }
}

// Caso de "¿A quién acudo?" según el tipo reportado (solo casa y coche ofrecen el atajo).
export const casoAcudo = (tipo) => (tipo === 'casa' || tipo === 'coche' ? tipo : null)

// ---------- Estado → chip y línea de tiempo ----------
export function chipEstado(estado) {
  if (estado === 'cola') return { clase: 'chip-cola', texto: 'En cola · sin señal' }
  if (estado === 'activo') return { clase: 'chip-act', texto: 'Activo' }
  if (estado === 'resuelto') return { clase: 'chip-res', texto: 'Resuelto' }
  if (estado === 'no_enviado') return { clase: 'chip-cola', texto: 'No se envió' }
  return { clase: 'chip-pend', texto: 'Pendiente' }
}

export function mensajeEnviado(estado) {
  if (estado === 'cola') return 'No hay señal. Tu reporte se guardó y se envía solo cuando vuelva. No tienes que hacer nada.'
  if (estado === 'activo') return 'Otros vecinos lo confirmaron: ya es una zona en el mapa y avisamos a quien se acerque.'
  return 'Ya está en el mapa como punto sin confirmar (anillo punteado). Si otros vecinos lo confirman, se vuelve zona.'
}

// Pasos: Enviado → Pendiente → Activo → Resuelto. k: done | now | next.
export function lineaDeTiempo(estado, creado) {
  const orden = { cola: 0, pendiente: 1, en_revision: 1, activo: 2, resuelto: 3, oculto: 3 }
  const i = orden[estado] ?? 1
  const k = (paso) => (paso < i ? 'done' : paso === i ? (paso === 3 ? 'done' : 'now') : 'next')
  return [
    { label: 'Enviado', desc: estado === 'cola' ? 'En cola: se envía cuando vuelva la señal' : horaCorta(creado), k: i === 0 ? 'now' : 'done' },
    { label: 'Pendiente', desc: 'Esperando que otros vecinos lo confirmen', k: k(1) },
    { label: 'Activo', desc: 'Ya es zona en el mapa', k: k(2) },
    { label: 'Resuelto', desc: 'Cuando dejen de confirmarlo o digan “ya no”', k: k(3) },
  ]
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
  return `hace ${Math.round(min / 60)} h`
}

// ---------- Enlaces para compartir ----------
export const linkMaps = (lat, lng) => `https://www.google.com/maps?q=${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`
export const linkWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`

export function textoFamilia(rep) {
  const que = {
    calle: rep.detalle === 'no' ? 'Se inundó la calle, no pasan carros.' : 'Se inundó la calle.',
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
    const { count, error } = await supabase.from('confirmaciones').select('id', { count: 'exact', head: true })
      .eq('reporte_id', id).eq('sigue', true)
    if (!error) confirmaciones = count ?? null
  } catch { /* sin red: se queda en null */ }
  return { data: { estado: rep.data.estado, ultima: rep.data.ultima_confirmacion, confirmaciones }, error: null }
}

// Error `sin_sesion`: se tira la sesión local vencida para que crearReporte abra una anónima nueva.
export async function soltarSesion() {
  try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* ya no había */ }
}
