import { describe, it, expect } from 'vitest'
import { perfilDeMedio, urlRutas, redondearOrigen, instruccion, reportesEnRuta, resumirRutas,
  pedirRutas, leerRutas, rutaActiva, elegirRuta, verRutaEnMapa, quitarRuta, olvidarSiOtroDestino, rutasPara, debeRecalcular } from './rutas.js'

describe('rutas dentro de la app (D-031)', () => {
  it('perfil según cómo se mueve', () => {
    expect(perfilDeMedio('auto')).toBe('car')
    expect(perfilDeMedio('moto')).toBe('car')
    expect(perfilDeMedio('transporte_publico')).toBe('car')
    expect(perfilDeMedio('peaton')).toBe('foot')
    expect(perfilDeMedio('bici')).toBe('bike')
  })
  it('el origen sale redondeado (~100 m), nunca el GPS exacto', () => {
    expect(redondearOrigen({ lat: 20.649712, lng: -103.401634 })).toEqual({ lat: 20.65, lng: -103.402 })
  })
  it('url con lng,lat, alternativas y geometría', () => {
    const u = urlRutas('foot', { lat: 20.65, lng: -103.4 }, { lat: 20.67, lng: -103.35 })
    expect(u).toBe('https://routing.openstreetmap.de/routed-foot/route/v1/driving/-103.4,20.65;-103.35,20.67?alternatives=true&overview=full&geometries=geojson&steps=true')
  })
  it('instrucciones en español', () => {
    expect(instruccion({ maneuver: { type: 'depart' }, name: 'Av. Vallarta' })).toBe('Sal por Av. Vallarta')
    expect(instruccion({ maneuver: { type: 'turn', modifier: 'left' }, name: 'Juárez' })).toBe('Gira a la izquierda en Juárez')
    expect(instruccion({ maneuver: { type: 'turn', modifier: 'sharp right' }, name: '' })).toBe('Gira fuerte a la derecha')
    expect(instruccion({ maneuver: { type: 'arrive' }, name: '' })).toBe('Llegaste a tu destino')
    expect(instruccion({ maneuver: { type: 'roundabout', exit: 2 }, name: 'Minerva' })).toBe('En la glorieta toma la salida 2 hacia Minerva')
  })
  it('reportes en el camino: a menos de 80 m de la línea', () => {
    const coords = [[-103.40, 20.65], [-103.39, 20.65]] // tramo este-oeste
    const reps = [{ id: 'cerca', lat: 20.6505, lng: -103.395 }, { id: 'lejos', lat: 20.66, lng: -103.395 }]
    expect(reportesEnRuta(coords, reps).map((r) => r.id)).toEqual(['cerca'])
  })
  it('resumen ordena por menos reportes en el camino y luego por tiempo', () => {
    const r = resumirRutas([
      { duration: 600, distance: 4000, geometry: { coordinates: [[-103.40, 20.65], [-103.39, 20.65]] }, legs: [{ steps: [] }] },
      { duration: 900, distance: 5000, geometry: { coordinates: [[-103.40, 20.70], [-103.39, 20.70]] }, legs: [{ steps: [] }] },
    ], [{ id: 'x', lat: 20.65, lng: -103.395 }])
    expect(r.map((x) => [x.min, x.enCamino.length])).toEqual([[15, 0], [10, 1]])
    expect(r[0].km).toBe('5.0')
  })
})

// OSRM falso: una ruta por destino, con duración/distancia según el destino, y respuesta con retraso controlable.
const osrm = (porDestino) => (url) => {
  const lng = url.split(';')[1].split(',')[0]
  const { min, km, espera = 0 } = porDestino[lng]
  const ruta = { duration: min * 60, distance: km * 1000, geometry: { coordinates: [[-103.40, 20.65], [+lng, 20.67]] }, legs: [{ steps: [] }] }
  return new Promise((res) => setTimeout(() => res({ json: async () => ({ code: 'Ok', routes: [ruta] }) }), espera))
}
const ORIGEN = { lat: 20.6497, lng: -103.4016 }
const SOL = { lat: 20.65, lng: -103.401, nombre: 'Plaza del Sol' }
const MINERVA = { lat: 20.674, lng: -103.387, nombre: 'Glorieta Minerva' }

describe('rutas: una sola fuente para panel y mapa (bug del testeo "1 min · 0.2 km" vs "11 min · 8.1 km")', () => {
  it('lo que ve el panel es exactamente lo que dibuja el mapa', async () => {
    quitarRuta()
    await pedirRutas({ medio: 'auto', origen: ORIGEN, destino: MINERVA }, osrm({ '-103.387': { min: 11, km: 8.1 } }))
    verRutaEnMapa(0)
    const e = leerRutas()
    expect(e.enMapa).toBe(true)
    expect(rutaActiva(e)).toBe(e.lista[0])
    expect([rutaActiva(e).min, rutaActiva(e).km]).toEqual([11, '8.1'])
    expect(rutasPara(e, MINERVA)).toBe(e)
  })
  it('una respuesta tardía del destino anterior no pisa la del nuevo', async () => {
    quitarRuta()
    const f = osrm({ '-103.401': { min: 1, km: 0.2, espera: 30 }, '-103.387': { min: 11, km: 8.1 } })
    const viejo = pedirRutas({ medio: 'auto', origen: ORIGEN, destino: SOL }, f)
    olvidarSiOtroDestino(MINERVA)
    await pedirRutas({ medio: 'auto', origen: ORIGEN, destino: MINERVA }, f)
    expect(await viejo).toBe(null)
    expect(leerRutas().destino).toBe(MINERVA)
    expect(rutaActiva().km).toBe('8.1')
  })
  it('cambiar de destino borra la ruta que el mapa mostraba', async () => {
    quitarRuta()
    await pedirRutas({ medio: 'auto', origen: ORIGEN, destino: SOL }, osrm({ '-103.401': { min: 1, km: 0.2 } }))
    verRutaEnMapa(0)
    olvidarSiOtroDestino(SOL)
    expect(leerRutas()).not.toBe(null) // mismo destino: se queda
    olvidarSiOtroDestino(MINERVA)
    expect(leerRutas()).toBe(null)
    expect(rutaActiva()).toBe(null)
  })
  it('elegir otra opción cambia la activa en panel y mapa a la vez', async () => {
    quitarRuta()
    await pedirRutas({ medio: 'auto', origen: ORIGEN, destino: MINERVA }, osrm({ '-103.387': { min: 11, km: 8.1 } }))
    elegirRuta(5) // no existe: se ignora
    expect(leerRutas().elegida).toBe(0)
  })
  it('si llega el GPS real lejos del punto de salida, hay que recalcular', async () => {
    quitarRuta()
    await pedirRutas({ medio: 'auto', origen: ORIGEN, destino: MINERVA }, osrm({ '-103.387': { min: 11, km: 8.1 } }))
    expect(debeRecalcular(leerRutas(), { lat: 20.6497, lng: -103.4017 })).toBe(false)
    expect(debeRecalcular(leerRutas(), { lat: 20.70, lng: -103.35 })).toBe(true)
  })
})
