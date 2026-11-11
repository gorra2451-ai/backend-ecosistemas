// Simulaciones para el testeo (modo prueba): inundaciones falsas cerca de ti para ver cómo se comporta la app
// (mapa, lista, "Tu zona", voz y vibración) sin esperar a que llueva. SOLO EN ESTE TELÉFONO: no se manda nada
// a la nube ni la ven los demás testers. Se mezclan en zonasPublicas() y reportesEnArea() (lib/api.js) y se
// borran al recargar.
let estado = { zonas: [], reportes: [] }
const subs = new Set()
const avisar = () => subs.forEach((f) => f())
export const suscribirSimulacion = (f) => { subs.add(f); return () => subs.delete(f) }
export const zonasSimuladas = () => estado.zonas
export const reportesSimulados = () => estado.reportes
export const leerSimulacion = () => estado

export const ESCENARIOS = [
  { nivel: 'bajo', titulo: 'Riesgo bajo', desc: 'El agua no pasa de la banqueta' },
  { nivel: 'medio', titulo: 'Riesgo medio', desc: 'Agua a media llanta' },
  { nivel: 'alto', titulo: 'Riesgo alto', desc: 'El agua cubre la llanta' },
  { nivel: 'critico', titulo: 'Riesgo crítico', desc: 'No pasan carros' },
]
const CONFIRMACIONES = { bajo: 5, medio: 10, alto: 15, critico: 20 } // umbrales de nivel (Más → Cómo interpretar)
const GRAV = { bajo: 'sin_riesgo', medio: 'limitado', alto: 'bloqueado', critico: 'bloqueado' }

// Punto a `m` metros de `ubic` con rumbo `grados` (0 = norte, 90 = este).
function desplazar(ubic, m, grados) {
  const r = (grados * Math.PI) / 180
  return {
    lat: ubic.lat + (m * Math.cos(r)) / 111320,
    lng: ubic.lng + (m * Math.sin(r)) / (111320 * Math.cos((ubic.lat * Math.PI) / 180)),
  }
}

function zona(p, nivel, ahora, n) {
  return {
    celda: `sim-${n}-${ahora}`, ...p, nivel,
    total_reportes: Math.max(1, Math.round(CONFIRMACIONES[nivel] / 5)), total_confirmaciones: CONFIRMACIONES[nivel],
    alguno_no_pasan_carros: GRAV[nivel] === 'bloqueado', actualizado_en: new Date(ahora).toISOString(), simulada: true,
  }
}
function reporte(p, tipo, nivel, ahora, n) {
  const riesgo = tipo === 'persona_en_riesgo'
  return {
    id: `sim-${n}-${ahora}`, tipo, ...p, estado: 'activo', simulada: true,
    gravedad: riesgo ? null : GRAV[nivel], nivel: riesgo ? null : (nivel === 'critico' ? 'alto' : nivel),
    pasan_carros: riesgo ? true : GRAV[nivel] !== 'bloqueado', confirmaciones_si: riesgo ? 1 : CONFIRMACIONES[nivel],
    creado_en: new Date(ahora - 20 * 60e3).toISOString(), ultima_confirmacion: new Date(ahora).toISOString(),
  }
}

// Una inundación de calle a ~150 m (dentro de "tu zona", sin tapar tu punto). Reemplaza la simulación anterior.
export function simularInundacion(ubic, nivel = 'medio', ahora = Date.now()) {
  const p = desplazar(ubic, 155, 45)
  const z = zona(p, nivel, ahora, nivel)
  estado = { zonas: [z], reportes: [reporte(p, 'calle', nivel, ahora, nivel)] }
  avisar()
  return z
}

// Escenario completo: un reporte de cada tipo y nivel repartido alrededor de ti (200 m a 1.4 km).
export const ESCENARIO = [
  ['calle', 'bajo', 220, 20], ['calle', 'alto', 480, 130], ['casa', 'medio', 350, 250], ['casa', 'bajo', 900, 330],
  ['coche', 'alto', 650, 80], ['coche', 'medio', 1100, 200], ['persona_en_riesgo', 'alto', 800, 300], ['calle', 'critico', 1400, 160],
]
export function cargarEscenario(ubic, ahora = Date.now()) {
  const zonas = []; const reportes = []
  ESCENARIO.forEach(([tipo, nivel, m, g], i) => {
    const p = desplazar(ubic, m, g)
    reportes.push(reporte(p, tipo, nivel, ahora, `e${i}`))
    if (tipo !== 'persona_en_riesgo') zonas.push(zona(p, nivel, ahora, `e${i}`))
  })
  estado = { zonas, reportes }
  avisar()
  return estado
}

export function quitarSimulaciones() { estado = { zonas: [], reportes: [] }; avisar() }

// Resultados de la API con lo simulado al final. Nunca mutan los datos reales.
const mezclar = (lista) => (res) => (lista().length ? { ...res, data: [...(res?.data || []), ...lista()] } : res)
export const conSimuladas = mezclar(zonasSimuladas)
export const conReportesSimulados = mezclar(reportesSimulados)
