import { describe, it, expect } from 'vitest'
import { avisoCorto, sugerenciasSinResultado, vistaLugar, encabezadoLugar, estadoCaminoDestino } from './buscar.js'
import { formatoResultado, categoriaLugar, consultaLugar } from './api.js'

describe('búsqueda: apodos y aviso de 3 letras', () => {
  it('lo que se manda a Nominatim traduce el apodo', () => {
    expect(consultaLugar('la Mine')).toBe('Glorieta Minerva, Guadalajara')
    expect(consultaLugar('Plaza del Sol')).toBe('Plaza del Sol')
    expect(consultaLugar('mi')).toBe(null)
  })
  it('aviso mientras escribe con menos de 3 letras', () => {
    expect(avisoCorto('')).toBe(null)
    expect(avisoCorto(' l ')).toBe('Escribe al menos 3 letras')
    expect(avisoCorto('la')).toBe('Escribe al menos 3 letras')
    expect(avisoCorto('la m')).toBe(null)
  })
  it('sin resultados: 3 sugerencias, primero las parecidas', () => {
    const s = sugerenciasSinResultado('minerv')
    expect(s).toHaveLength(3)
    expect(s[0]).toBe('Glorieta Minerva, Guadalajara')
    expect(new Set(s).size).toBe(3)
    expect(sugerenciasSinResultado('xyzxyz')).toHaveLength(3)
  })
})

describe('formato de resultados (nombre, dirección, municipio, categoría)', () => {
  const minerva = {
    lat: '20.674', lon: '-103.387', name: 'Glorieta Minerva', category: 'historic', type: 'monument', addresstype: 'historic',
    address: { road: 'Avenida Vallarta', suburb: 'Vallarta Poniente', city: 'Guadalajara' },
  }
  it('primero el nombre, luego la dirección, municipio aparte', () => {
    const r = formatoResultado(minerva)
    expect(r.titulo).toBe('Glorieta Minerva')
    expect(r.direccion).toBe('Avenida Vallarta, Vallarta Poniente')
    expect(r.municipio).toBe('Guadalajara')
    expect(r.categoria).toBe('Monumento')
    expect(r.lat).toBe(20.674)
    expect(r.nombre).toBe('Avenida Vallarta, Vallarta Poniente, Guadalajara') // etiqueta de siempre (Reportar)
  })
  it('categoría específica o nada (nunca "Lugar de interés")', () => {
    expect(categoriaLugar({ category: 'shop', type: 'mall' })).toBe('Centro comercial')
    expect(categoriaLugar({ category: 'highway', type: 'primary' })).toBe('Calle')
    expect(categoriaLugar({ category: 'place', type: 'neighbourhood' })).toBe('Colonia')
    expect(categoriaLugar({ category: 'amenity', type: 'algo_raro' })).toBe(null)
  })
  it('una calle sin nombre propio usa la calle como título y no la repite', () => {
    const r = formatoResultado({ lat: '1', lon: '2', name: '', category: 'highway', type: 'primary',
      address: { road: 'Avenida Patria', suburb: 'Jardines Universidad', city: 'Zapopan' } })
    expect(r.titulo).toBe('Avenida Patria')
    expect(r.direccion).toBe('Jardines Universidad')
    expect(r.municipio).toBe('Zapopan')
  })
})

describe('vista del destino', () => {
  it('encabezado "Nombre · Municipio"', () => {
    expect(encabezadoLugar(formatoResultado({ lat: '1', lon: '2', name: 'Plaza del Sol', type: 'mall',
      address: { road: 'Av. López Mateos', city: 'Zapopan' } }))).toBe('Plaza del Sol · Zapopan')
  })
  it('destino que llega del detalle de alerta ({nombre} con comas)', () => {
    expect(vistaLugar({ lat: 1, lng: 2, nombre: 'Av. Vallarta 1200, Americana, Guadalajara' }))
      .toEqual({ nombre: 'Av. Vallarta 1200', detalle: 'Americana', municipio: 'Guadalajara', categoria: null })
    expect(encabezadoLugar({ nombre: 'Calle inundada' })).toBe('Calle inundada')
  })
  it('estado del camino separado del estado del destino', () => {
    expect(estadoCaminoDestino({ enCamino: 2, enDestino: 0 })).toBe('En el camino: 2 reportes · En el destino: sin reportes registrados')
    expect(estadoCaminoDestino({ enCamino: 0, enDestino: 1 })).toBe('En el camino: sin reportes · En el destino: 1 reporte cerca')
    expect(estadoCaminoDestino({ enDestino: 0 })).toBe('En el destino: sin reportes registrados')
  })
  it('si no se revisó todo el trayecto, nunca dice "sin reportes" en el camino (revisión de Leo)', () => {
    expect(estadoCaminoDestino({ enCamino: 0, enDestino: 0, revisada: false }))
      .toBe('En el camino: no pudimos revisar todo el trayecto · En el destino: sin reportes registrados')
    expect(estadoCaminoDestino({ enCamino: 1, enDestino: 0, revisada: false }))
      .toBe('En el camino: 1 reporte, no pudimos revisar todo el trayecto · En el destino: sin reportes registrados')
  })
})
