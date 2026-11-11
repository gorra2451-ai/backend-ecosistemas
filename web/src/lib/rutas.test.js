import { describe, it, expect } from 'vitest'
import { perfilDeMedio, urlRutas, redondearOrigen, instruccion, reportesEnRuta, resumirRutas } from './rutas.js'

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
