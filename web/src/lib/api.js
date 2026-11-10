// Capa única de datos. Las pantallas NO llaman a supabase directo: usan estas funciones.
// Contrato: docs/API.md. Cada función regresa { data, error } donde error es un código del contrato.
import { supabase } from './supabase.js'

const CODIGOS = [ // códigos reales de supabase/migrations (los más largos primero: se busca por substring)
  'reporte_no_autorizado', 'proveedor_push_no_permitido', 'tipo_archivo_invalido', 'area_demasiado_grande',
  'parametros_invalidos', 'limite_suscripciones', 'suscripcion_en_uso', 'duplicado_cercano', 'limite_evidencias',
  'reporte_no_activo', 'reporte_no_existe', 'archivo_no_existe', 'archivo_invalido', 'limite_entradas',
  'limite_por_hora', 'motivo_requerido', 'estado_invalido', 'propio_reporte', 'no_autorizado', 'fuera_de_zmg',
  'sin_perfil', 'sin_sesion', 'id_en_uso',
]

export function codigoError(err) {
  if (!err) return null
  const m = String(err.message || err)
  const c = CODIGOS.find((k) => m.includes(k))
  if (c) return c
  if (/fetch|network|Load failed/i.test(m)) return 'sin_red'
  return 'desconocido'
}

// Copy de la pantalla de error del design system (App.dc.html · error).
const MENSAJES = {
  fuera_de_zmg: { titulo: 'Este punto está fuera de la ZMG', texto: 'Por ahora solo cubrimos la zona metropolitana de Guadalajara. Si es emergencia, llama al 911.' },
  limite_por_hora: { titulo: 'Ya enviaste varios reportes esta hora', texto: 'Para evitar spam hay un límite por hora. Mientras, puedes confirmar reportes cercanos.' },
  duplicado_cercano: { titulo: 'Ya reportaste este punto', texto: 'Tu reporte anterior sigue en el mapa. Puedes seguirlo desde “Mi reporte”.' },
  sin_sesion: { titulo: 'Se cerró tu sesión anónima', texto: 'Abrimos una nueva sin pedirte datos y enviamos tu reporte.' },
  sin_red: { titulo: 'No hay señal', texto: 'Tu acción se guardó y se envía sola cuando vuelva la conexión.' },
  limite_entradas: { titulo: 'Demasiadas entradas en una hora', texto: 'Espera unos minutos y vuelve a intentar.' },
}
export function mensajeError(codigo) {
  return MENSAJES[codigo] || { titulo: 'Algo salió mal', texto: 'Vuelve a intentar en un momento. Si es emergencia, llama al 911.' }
}

export function nivelDeZona(z) {
  const n = String(z?.nivel || '').toLowerCase()
  return ['bajo', 'medio', 'alto'].includes(n) ? n : 'bajo'
}

export function bboxAlrededor(lat, lng, radioM) {
  const dLat = radioM / 111320
  const dLng = radioM / (111320 * Math.cos((lat * Math.PI) / 180))
  return { min_lat: lat - dLat, max_lat: lat + dLat, min_lng: lng - dLng, max_lng: lng + dLng }
}

const r = async (p) => {
  try {
    const { data, error } = await p
    return { data, error: codigoError(error) }
  } catch (e) {
    return { data: null, error: codigoError(e) }
  }
}

// ---------- Sesión (D-019) ----------
export async function asegurarSesion() {
  const { data } = await supabase.auth.getSession()
  if (data?.session) return { data: data.session, error: null }
  return r(supabase.auth.signInAnonymously().then(({ data, error }) => ({ data: data?.session, error })))
}
export const registrarEntrada = (medio) => r(supabase.rpc('registrar_entrada', { medio })) // peaton|bici|auto|transporte_publico
export const guardarAccesibilidad = (daltonismo) => r(supabase.rpc('guardar_accesibilidad', { prefs: { daltonismo: !!daltonismo } }))

// ---------- Reportar ----------
export async function crearReporte({ id, tipo, pasanCarros, lat, lng, precision }) {
  await asegurarSesion()
  return r(supabase.rpc('crear_reporte', {
    p_id: id, p_tipo: tipo, p_pasan_carros: pasanCarros ?? null,
    p_lat: lat, p_lng: lng, p_precision_m: Math.round(precision || 30),
  }))
}
export async function subirEvidencia(reporteId, archivo) {
  const ext = (archivo.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
  const tipo = archivo.type.startsWith('video') ? 'video' : 'foto'
  const ruta = `${reporteId}/${crypto.randomUUID()}.${ext}`
  const up = await r(supabase.storage.from('evidencias').upload(ruta, archivo, { contentType: archivo.type, upsert: false }))
  if (up.error) return up
  return r(supabase.rpc('agregar_evidencia', { p_reporte_id: reporteId, p_ruta: ruta, p_tipo: tipo }))
}

// ---------- Confirmar ----------
export async function reportesCercanos(lat, lng, radio = 300) {
  await asegurarSesion()
  return r(supabase.rpc('reportes_cercanos', { p_lat: lat, p_lng: lng, p_radio_m: radio }))
}
export const confirmarReporte = async (id, sigue) => (await asegurarSesion(), r(supabase.rpc('confirmar_reporte', { p_reporte_id: id, p_sigue: sigue })))
export const marcarFalso = async (id) => (await asegurarSesion(), r(supabase.rpc('marcar_falso', { p_reporte_id: id })))

// ---------- Mapa ----------
export const zonasPublicas = () => r(supabase.from('zonas_publicas').select('*'))
export const reportesEnArea = (b) => r(supabase.rpc('reportes_activos_en_area', b))
export const refugiosPublicos = () => r(supabase.from('refugios_publicos').select('*'))
export const alertasClima = () => r(supabase.from('alertas_clima_vigentes').select('*'))

// Realtime: cualquier cambio en reportes o zonas → refrescar. Devuelve función para desuscribir.
export function escucharCambios(alCambiar) {
  const chs = ['reportes', 'zonas'].map((n) =>
    supabase.channel(n).on('broadcast', { event: 'cambio' }, () => alCambiar(n)).subscribe())
  return () => chs.forEach((c) => supabase.removeChannel(c))
}

// ---------- Derivación ----------
export const derivar = (caso, municipio, lat, lng) =>
  r(supabase.rpc('derivar', { p_caso: caso, p_municipio: municipio, p_lat: lat, p_lng: lng })) // casa|coche|persona_herida|tercero|otro

// ---------- Avisos ----------
export async function suscribirPush(sub, municipio) {
  await asegurarSesion()
  const j = sub.toJSON()
  return r(supabase.rpc('suscribir_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_municipio: municipio }))
}
export const bajaPush = (endpoint) => r(supabase.rpc('baja_push', { p_endpoint: endpoint }))
