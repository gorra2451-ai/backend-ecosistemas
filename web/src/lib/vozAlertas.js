// Modo voz (prefs.voz): qué leer en voz alta. Lógica pura (sin React ni red), probada en vozAlertas.test.js.
// Solo compara zonas_publicas entre cargas; nunca guarda la ubicación de nadie (AGENTS §8).
import { distanciaM, estadoZona, nivelV2, textoNivel, NIVELES } from './mapa.js'
import { RADIO_ALERTA_M } from './confirmar.js'

// Radio para avisar por voz: el mismo de la alerta previa de Confirmar (400 m). Solo front · POR CONFIRMAR.
export const RADIO_VOZ_M = RADIO_ALERTA_M
const MAX_FRASES = 2
export const FRASE_SIN_UBICACION = 'Activa tu ubicación para saber cómo está tu zona.'

// Solo el GPS real del dispositivo cuenta: CENTRO_ZMG (Plaza del Sol, real=false) es un ejemplo, no tu ubicación.
export const ubicacionReal = (ubic) => !!ubic && ubic.real === true

// 398 → "400 metros" · 1450 → "1.4 kilómetros" (como formatoDist, pero dicho en palabras).
export function metrosVoz(m) {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} metros`
  return `${(m / 1000).toFixed(1)} kilómetros`
}

const rango = (n) => NIVELES.indexOf(n)
const nivelTxt = (n) => textoNivel(n).toLowerCase()

// Frases nuevas entre dos cargas de zonas: zona que aparece a ≤ radio o zona que sube de nivel.
// anteriores = null (primera carga) o sin GPS real → no habla. Máximo 2 frases; el resto, "y N zonas más".
export function cambiosParaVoz(anteriores, actuales, ubic, radioM = RADIO_VOZ_M) {
  if (!anteriores || !ubicacionReal(ubic)) return []
  const antes = new Map(anteriores.map((z) => [z.celda, nivelV2(z)]))
  const cambios = []
  for (const z of actuales || []) {
    const d = distanciaM(ubic, z)
    if (!(d <= radioM)) continue
    const nivel = nivelV2(z)
    if (!antes.has(z.celda)) cambios.push({ d, t: `Nueva zona inundada, nivel ${nivelTxt(nivel)}, a ${metrosVoz(d)}` })
    else if (rango(nivel) > rango(antes.get(z.celda))) cambios.push({ d, t: `Zona inundada subió a nivel ${nivelTxt(nivel)}, a ${metrosVoz(d)}` })
  }
  cambios.sort((a, b) => a.d - b.d)
  const frases = cambios.slice(0, MAX_FRASES).map((c) => c.t)
  const resto = cambios.length - frases.length
  if (resto > 0) frases[frases.length - 1] += `; y ${resto} ${resto === 1 ? 'zona más' : 'zonas más'}`
  return frases.map((f) => f + '.')
}

// Unidades en palabras para la síntesis: "300 m" → "300 metros", "1.1 km" → "1.1 kilómetros".
const enPalabras = (s) => s.replace(/(\d) km\b/g, '$1 kilómetros').replace(/(\d) m\b/g, '$1 metros')

// Botón "Escuchar": resume tu zona con la misma frase de la barra superior (estadoZona).
// Sin GPS real no describe nada: pide activar la ubicación.
export function fraseEstado({ zonas = [], ubic, municipio, revisado, ahora } = {}) {
  if (!ubicacionReal(ubic)) return FRASE_SIN_UBICACION
  const e = estadoZona({ zonas: zonas.map((z) => ({ ...z, nivel: nivelV2(z) })), ubic, municipio, revisado, ahora })
  return [e.frase, e.sub].filter(Boolean).map((p) => enPalabras(p) + '.').join(' ')
}
