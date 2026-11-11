import { describe, it, expect, beforeEach } from 'vitest'
import { simularInundacion, quitarSimulaciones, zonasSimuladas, conSimuladas, ESCENARIOS } from './simulacion.js'

const ubic = { lat: 20.6497, lng: -103.4016 }
const distM = (a, b) => Math.hypot((a.lat - b.lat) * 111320, (a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180))

describe('simulaciones del modo prueba (solo en este teléfono)', () => {
  beforeEach(() => quitarSimulaciones())

  it('crea una zona con la forma de zonas_publicas, marcada como simulada y cerca de ti', () => {
    const z = simularInundacion(ubic, 'medio', Date.parse('2026-11-11T15:00:00Z'))
    expect(z).toMatchObject({ nivel: 'medio', simulada: true, total_confirmaciones: 10, alguno_no_pasan_carros: false })
    expect(typeof z.celda).toBe('string')
    expect(distM(z, ubic)).toBeGreaterThan(80)
    expect(distM(z, ubic)).toBeLessThan(300)
  })

  it('crítico simula que no pasan carros', () => {
    expect(simularInundacion(ubic, 'critico').alguno_no_pasan_carros).toBe(true)
  })

  it('se mezclan con las zonas reales sin tocarlas y se pueden quitar', () => {
    simularInundacion(ubic, 'medio')
    const real = [{ celda: 'r1', nivel: 'bajo' }]
    expect(conSimuladas({ data: real, error: null }).data).toHaveLength(2)
    expect(real).toHaveLength(1)
    quitarSimulaciones()
    expect(zonasSimuladas()).toEqual([])
    expect(conSimuladas({ data: real, error: null }).data).toEqual(real)
  })

  it('si la consulta real falla, igual se ven las simuladas', () => {
    simularInundacion(ubic, 'alto')
    expect(conSimuladas({ data: null, error: 'sin_red' }).data).toHaveLength(1)
  })

  it('hay un escenario por nivel', () => {
    expect(ESCENARIOS.map((e) => e.nivel)).toEqual(['bajo', 'medio', 'alto', 'critico'])
  })
})
