// MÓDULO D · Confirmación. Lógica pura del aviso "¿Sigue inundado?" + envoltura de las RPC.
// Contrato: docs/API.md §Confirmación. Códigos reales en 20261023000200_confirmacion.sql:
// sin_sesion, reporte_no_existe, propio_reporte, reporte_no_activo, parametros_invalidos.
// (No existe `ya_confirmado`: votar otra vez actualiza el voto anterior.)
import { asegurarSesion, confirmarReporte, marcarFalso } from './api.js'

export const RADIO_CERCANOS_M = 300
export const CADA_MS = 60_000
export const CIERRE_MS = 10_000
const CLAVE = 'aguas.confirm.preguntados'

// El más cercano que no es mío y que no se preguntó en esta sesión. La RPC ya ordena por
// distancia, pero no dependemos de eso.
export function elegirCercano(lista, preguntados = []) {
  const ya = new Set(preguntados)
  const candidatos = (lista || []).filter((r) => r && r.es_propio === false && !ya.has(r.id))
  if (!candidatos.length) return null
  return candidatos.reduce((a, b) => ((b.distancia_m ?? Infinity) < (a.distancia_m ?? Infinity) ? b : a))
}

// ¿Puede el detector abrir el aviso ahora?
export function puedePreguntar({ ubic, screen, overlay }) {
  return !!ubic?.real && !screen && !overlay
}

export function haceMin(ts, ahora = Date.now()) {
  if (!ts) return null
  const min = Math.max(0, Math.round((ahora - new Date(ts).getTime()) / 60000))
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  return `hace ${h} h`
}

const QUE = { calle: 'una calle inundada', casa: 'una casa inundada', coche: 'un coche en el agua', persona_en_riesgo: 'una persona en riesgo' }

// "una calle inundada a 40 m" — el backend no manda nombre de calle (solo lat/lng).
export function lugarDe(rep) {
  const que = QUE[rep?.tipo] || 'un reporte de inundación'
  const d = Number.isFinite(rep?.distancia_m) ? ` a ${Math.round(rep.distancia_m)} m` : ''
  return que + d
}

// Línea de tiempo: reportes_cercanos solo trae ultima_confirmacion (no creado_en).
export function cuandoDe(rep, ahora = Date.now()) {
  const h = haceMin(rep?.ultima_confirmacion, ahora)
  return h ? `confirmado ${h}` : 'sin confirmar todavía'
}

const MSG = {
  propio: 'Ese reporte es tuyo: no puedes confirmarlo.',
  reporte_no_activo: 'Ese reporte ya se cerró. Gracias de todos modos.',
  reporte_no_existe: 'Ese reporte ya no existe.',
  sin_sesion: 'Se cerró tu sesión. Vuelve a intentar.',
  sin_red: 'No hay señal. Intenta de nuevo cuando vuelva.',
  parametros_invalidos: 'No pudimos enviar tu respuesta. Vuelve a intentar.',
}
export function mensajeConfirmar(codigo) {
  return MSG[codigo] || 'No pudimos enviar tu respuesta. Vuelve a intentar.'
}

// accion: 'sigue' | 'ya_no' | 'falso'
export async function responder(id, accion) {
  await asegurarSesion()
  if (accion === 'falso') return marcarFalso(id)
  return confirmarReporte(id, accion === 'sigue')
}

// Ids ya preguntados en esta sesión (sessionStorage; sin storage → memoria).
let memoria = []
export function leerPreguntados() {
  try { const v = sessionStorage.getItem(CLAVE); return v ? JSON.parse(v) : memoria } catch { return memoria }
}
export function marcarPreguntado(id) {
  const l = [...new Set([...leerPreguntados(), id])].slice(-200)
  memoria = l
  try { sessionStorage.setItem(CLAVE, JSON.stringify(l)) } catch { /* sin storage */ }
}
