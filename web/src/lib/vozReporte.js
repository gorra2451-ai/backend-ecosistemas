// "Reportar con voz" (paso Tipo): una frase → { tipo, gravedad } para preseleccionar el flujo.
// Solo preselecciona: la ubicación y el botón de envío siguen siendo manuales.
// Lib pura (sin React ni estado global). La voz cruda usa la misma API que confirmar.js (claseVoz).
import { claseVoz } from './confirmar.js'
import { GRAVEDAD } from './reportar.js'

export const NO_TE_ENTENDI = 'No te entendí. Intenta: «calle inundada, agua a la rodilla»'

// nivel de la UI (Bajo/Medio/Alto) → clave del contrato que usa Detalles (sin_riesgo/limitado/bloqueado).
const CLAVE = Object.fromEntries(GRAVEDAD.map((g) => [g.nivel, g.k]))
const ORDEN = ['bajo', 'medio', 'alto']

// Minúsculas, sin acentos; la puntuación queda como corte de frase "|".
function normalizar(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,;:!?¡¿]+/g, ' | ').replace(/[^a-z| ]/g, ' ').replace(/\s+/g, ' ').trim()
}

const NEG = new Set(['no', 'ni', 'nunca', 'tampoco'])
const CORTE = new Set(['|', 'sino', 'pero'])
const VENTANA_NEG = 4 // "no llega a la rodilla": el "no" está 4 palabras antes

// "no es mi casa" (negación antes, misma frase) o "mi casa no, …" (negación al cierre de la frase).
function negado(toks, i, fin) {
  for (let j = i - 1; j >= Math.max(0, i - VENTANA_NEG); j--) {
    if (CORTE.has(toks[j])) break
    if (NEG.has(toks[j])) return true
  }
  return toks[fin] === 'no' && (fin + 1 >= toks.length || CORTE.has(toks[fin + 1]))
}

// Menciones NO negadas de un patrón: [{ i, fin }] en índices de palabra.
function menciones(s, patron) {
  const toks = s.split(' ')
  const re = new RegExp(`(?<![a-z])(?:${patron})(?![a-z])`, 'g')
  const out = []
  for (const m of s.matchAll(re)) {
    const i = s.slice(0, m.index).split(' ').length - 1
    const fin = i + m[0].split(' ').length
    if (!negado(toks, i, fin)) out.push({ i, fin })
  }
  return out
}

const VEHICULO = '(?:carros?|coches?|autos?|vehiculos?|camiones|camionetas?)'
// "No pasan carros" es nivel Alto (y no es el tipo Coche). Se consume antes de lo demás.
const ALTO_FRASE = `no (?:pasan|pasa|cruzan|cruza) (?:los |ni los |ningun |ni un )?${VEHICULO}|no se puede (?:pasar|cruzar)|no hay paso|no cruzar`
// Frases de paso de vehículos: dan nivel pero no tipo.
const PASO_VEHICULOS = `(?:pasan|pasa|cruzan|cruza|cubre|cubren|tapa|tapan) (?:a )?(?:los |las |el |la )?${VEHICULO}`

const NIVEL = {
  alto: 'cintura|pecho|cuello|techo|alto|alta|(?:cubre|cubren|tapa|tapan) (?:a )?(?:los |el )?' + VEHICULO,
  medio: 'rodillas?|media llanta|llantas?|medio(?! de)|mejor esperar',
  bajo: `charcos?|encharcad[oa]s?|tobillos?|poca agua|poquit[oa]|bajo|se puede pasar|con cuidado|(?:pasan|pasa) (?:los )?${VEHICULO}`,
}

const TIPO = {
  casa: 'casas?|hogar|departamento|depa|vivienda|cochera|cocina|sala|recamara',
  coche: `${VEHICULO}|automovil(?:es)?|troca`,
  calle: 'calles?|avenidas?|calzada|camellon|banqueta|cruce|esquina|glorieta|periferico|carretera|lateral|paso a desnivel|puente',
}
const PERSONA = 'personas?|alguien|gente|nin[oa]s?|senor(?:a|es|as)?|abuelit[oa]s?|bebes?|familia|hombre|mujer|estoy|estamos'
const RIESGO = 'atrapad[oa]s?|riesgo|herid[oa]s?|arrastr[a-z]*|ahog[a-z]*|peligro|auxilio|rescate|dentro|adentro|encerrad[oa]s?|corriente'
const CERCA_RIESGO = 3 // "hay una persona atrapada": la palabra de riesgo va junto a la persona
const PRIORIDAD = ['casa', 'coche', 'calle'] // lo específico gana a la calle ("mi coche quedó atrapado en la calle")

function nivelDe(s) {
  const altoFrase = menciones(s, ALTO_FRASE).length > 0
  const sinFrase = s.replace(new RegExp(`(?<![a-z])(?:${ALTO_FRASE})(?![a-z])`, 'g'), '|')
  const hallados = ORDEN.filter((n) => menciones(sinFrase, NIVEL[n]).length)
  if (altoFrase) hallados.push('alto')
  const max = hallados.sort((a, b) => ORDEN.indexOf(b) - ORDEN.indexOf(a))[0]
  return max ? CLAVE[max] : null
}

function tipoDe(s) {
  const t = s.replace(new RegExp(`(?<![a-z])(?:no )?(?:${PASO_VEHICULOS})(?![a-z])`, 'g'), '|')
  const riesgos = menciones(t, RIESGO)
  const enRiesgo = menciones(t, PERSONA).some((p) => riesgos.some((r) => Math.abs(r.i - p.i) <= CERCA_RIESGO))
  if (enRiesgo) return 'persona_en_riesgo'
  return PRIORIDAD.find((k) => menciones(t, TIPO[k]).length) || null
}

export function interpretarReporteVoz(texto) {
  const s = normalizar(texto)
  if (!s) return { tipo: null, gravedad: null }
  return { tipo: tipoDe(s), gravedad: nivelDe(s) }
}

// Alternativas del reconocedor → destino. Sin tipo no se avanza (se queda en Tipo con el mensaje).
export function resolverReporteVoz(alternativas) {
  for (const a of alternativas || []) {
    const r = interpretarReporteVoz(a)
    if (r.tipo) return { ok: true, tipo: r.tipo, gravedad: r.gravedad }
  }
  return { ok: false, mensaje: NO_TE_ENTENDI }
}

// Escucha una frase en es-MX y entrega las alternativas en texto crudo (cb(string[]); [] si nada).
// Devuelve una función para cancelar (tras cancelar ya no se llama a cb). Análoga a escucharVoz.
export function escucharFrase(cb, Clase = claseVoz()) {
  if (!Clase) { cb([]); return () => {} }
  let listo = false
  const fin = (v) => { if (!listo) { listo = true; cb(v) } }
  let rec
  try {
    rec = new Clase()
    rec.lang = 'es-MX'
    rec.interimResults = false
    rec.maxAlternatives = 3
    rec.onresult = (e) => fin(Array.from(e.results?.[0] || []).map((a) => String(a.transcript || '')).filter(Boolean))
    rec.onerror = () => fin([])
    rec.onend = () => fin([])
    rec.start()
  } catch { fin([]) }
  return () => { listo = true; try { rec?.abort() } catch { /* nada */ } }
}
