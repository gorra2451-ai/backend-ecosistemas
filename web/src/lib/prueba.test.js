import { describe, it, expect } from 'vitest'
import { esModoPrueba, radioCercanos, RADIO_PRUEBA_M, RADIO_NORMAL_M } from './prueba.js'

const mem = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = String(v) } } }

describe('modo prueba (?prueba=1)', () => {
  it('se activa con ?prueba=1 y se recuerda al recargar sin el parámetro', () => {
    const s = mem()
    expect(esModoPrueba('?prueba=1', s)).toBe(true)
    expect(esModoPrueba('', s)).toBe(true)
  })
  it('?prueba=0 lo apaga; sin parámetro ni memoria está apagado', () => {
    const s = mem()
    esModoPrueba('?prueba=1', s)
    expect(esModoPrueba('?prueba=0', s)).toBe(false)
    expect(esModoPrueba('', s)).toBe(false)
    expect(esModoPrueba('', mem())).toBe(false)
  })
  it('no truena si el almacenamiento falla', () => {
    const roto = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }
    expect(esModoPrueba('?prueba=1', roto)).toBe(true)
    expect(esModoPrueba('', roto)).toBe(false)
  })
  it('radio de "Cerca de ti": 300 m normal, toda la ZMG en prueba (el backend lo topa con radio_cercanos_max_m)', () => {
    expect(radioCercanos(false)).toBe(RADIO_NORMAL_M)
    expect(RADIO_NORMAL_M).toBe(300)
    expect(radioCercanos(true)).toBe(RADIO_PRUEBA_M)
    expect(RADIO_PRUEBA_M).toBeGreaterThanOrEqual(40000)
  })
})
