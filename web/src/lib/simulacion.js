// Simulaciones para el testeo (modo prueba): una inundación falsa cerca de ti para ver cómo se comporta la app
// (mapa, lista, "Tu zona", voz y vibración) sin esperar a que llueva. SOLO EN ESTE TELÉFONO: no se manda nada
// a la nube ni la ven los demás testers. Se mezcla en zonasPublicas() (lib/api.js) y se borra al recargar.
let zonas = []
const subs = new Set()
const avisar = () => subs.forEach((f) => f())
export const suscribirSimulacion = (f) => { subs.add(f); return () => subs.delete(f) }
export const zonasSimuladas = () => zonas

export const ESCENARIOS = [
  { nivel: 'bajo', titulo: 'Riesgo bajo', desc: 'Encharcamiento, pasan carros con precaución' },
  { nivel: 'medio', titulo: 'Riesgo medio', desc: 'Agua a media llanta' },
  { nivel: 'alto', titulo: 'Riesgo alto', desc: 'Calle muy inundada' },
  { nivel: 'critico', titulo: 'Riesgo crítico', desc: 'No pasan carros' },
]
const CONFIRMACIONES = { bajo: 5, medio: 10, alto: 15, critico: 20 } // umbrales de nivel (Más → Cómo interpretar)

// ~150 m al noreste de ti: dentro de "tu zona" (300 m) pero sin tapar tu punto.
export function simularInundacion(ubic, nivel = 'medio', ahora = Date.now()) {
  const dLat = 110 / 111320
  const dLng = 110 / (111320 * Math.cos((ubic.lat * Math.PI) / 180))
  const z = {
    celda: `sim-${nivel}-${ahora}`, lat: ubic.lat + dLat, lng: ubic.lng + dLng, nivel,
    total_reportes: Math.max(1, Math.round(CONFIRMACIONES[nivel] / 5)), total_confirmaciones: CONFIRMACIONES[nivel],
    alguno_no_pasan_carros: nivel === 'critico', actualizado_en: new Date(ahora).toISOString(), simulada: true,
  }
  zonas = [z] // una a la vez: más fácil de entender en la prueba
  avisar()
  return z
}

export function quitarSimulaciones() { zonas = []; avisar() }

// Resultado de zonasPublicas() con las simuladas al final. Nunca muta los datos reales.
export function conSimuladas(res) {
  if (!zonas.length) return res
  return { ...res, data: [...(res?.data || []), ...zonas] }
}
