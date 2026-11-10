import { describe, it, expect } from 'vitest'
import { elegirCercano, puedePreguntar, haceMin, lugarDe, cuandoDe, mensajeConfirmar } from './confirmar.js'

const r = (id, distancia_m, es_propio = false) => ({ id, distancia_m, es_propio, tipo: 'calle' })

describe('elegirCercano', () => {
  it('elige el más cercano que no es propio', () => {
    expect(elegirCercano([r('a', 50, true), r('b', 120), r('c', 80)]).id).toBe('c')
  })
  it('salta los ya preguntados en la sesión', () => {
    expect(elegirCercano([r('c', 80), r('b', 120)], ['c']).id).toBe('b')
  })
  it('null si no hay candidatos', () => {
    expect(elegirCercano([r('a', 10, true)])).toBe(null)
    expect(elegirCercano([], [])).toBe(null)
    expect(elegirCercano(null)).toBe(null)
  })
  it('es_propio null/undefined no cuenta como ajeno', () => {
    expect(elegirCercano([{ id: 'x', distancia_m: 5 }])).toBe(null)
  })
})

describe('puedePreguntar', () => {
  const u = { real: true }
  it('solo con ubicación real, sin pantalla ni overlay', () => {
    expect(puedePreguntar({ ubic: u, screen: null, overlay: null })).toBe(true)
    expect(puedePreguntar({ ubic: { real: false }, screen: null, overlay: null })).toBe(false)
    expect(puedePreguntar({ ubic: u, screen: 'tipo', overlay: null })).toBe(false)
    expect(puedePreguntar({ ubic: u, screen: null, overlay: { tipo: 'confirm' } })).toBe(false)
  })
})

describe('textos', () => {
  const ahora = Date.parse('2026-11-10T12:00:00Z')
  it('haceMin', () => {
    expect(haceMin('2026-11-10T11:56:00Z', ahora)).toBe('hace 4 min')
    expect(haceMin('2026-11-10T11:59:50Z', ahora)).toBe('hace un momento')
    expect(haceMin('2026-11-10T10:00:00Z', ahora)).toBe('hace 2 h')
    expect(haceMin(null, ahora)).toBe(null)
  })
  it('lugarDe y cuandoDe', () => {
    expect(lugarDe({ tipo: 'calle', distancia_m: 41.6 })).toBe('una calle inundada a 42 m')
    expect(cuandoDe({ ultima_confirmacion: null }, ahora)).toBe('sin confirmar todavía')
    expect(cuandoDe({ ultima_confirmacion: '2026-11-10T11:56:00Z' }, ahora)).toBe('confirmado hace 4 min')
  })
  it('mensajeConfirmar cubre los códigos reales', () => {
    expect(mensajeConfirmar('propio')).toMatch(/tuyo/)
    expect(mensajeConfirmar('reporte_no_activo')).toMatch(/cerró/)
    expect(mensajeConfirmar('raro')).toMatch(/Vuelve a intentar/)
  })
})
